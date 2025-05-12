import { useState, useCallback, useRef } from 'react';
import { ConnectionState } from "../utils/connectionState";
import { useAgoraRTC } from './useAgoraRTC';
import { useAgoraRTM } from './useAgoraRTM';

/**
 * Hook that combines Agora RTC and RTM functionality for a complete connection management
 */
export function useAgoraConnection({
  agoraConfig,
  setAgoraConfig,
  derivedChannelName,
  agentEndpoint,
  updateConnectionState,
  processAndSendMessageToAvatar,
  showToast,
  agoraClientRef,
  trulienceAvatarRef,
  urlParams
}) {
  const [agentId, setAgentId] = useState(null);
  const abortControllerRef = useRef(null);
  const isEndpointConnectedRef = useRef(false);
  
  // Initialize Agora RTC hook
  const agoraRTC = useAgoraRTC({
    agoraConfig,
    derivedChannelName,
    updateConnectionState,
    showToast,
    agoraClientRef,
    trulienceAvatarRef
  });
  
  // Initialize Agora RTM hook
  const agoraRTM = useAgoraRTM({
    agoraConfig,
    derivedChannelName,
    updateConnectionState,
    urlParams,
    processAndSendMessageToAvatar
  });

   // Create and set abort controller for connection cancellation
   const createAbortController = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    return abortControllerRef.current;
  }, []);

  const disconnectAbortController = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  /**
   * Function to communicate with the agent endpoint and get connection tokens
   *
   * @returns {Promise<Object>} - Token, UID and success status
   */
  const callAgentEndpoint = useCallback(async () => {
    try {
      // Default values from config
      let result = {
        token: agoraConfig.token,
        uid: agoraConfig.uid,
        success: true
      };
      
      // Early return if no agent endpoint provided
      if (!agentEndpoint) {
        return result;
      }
      isEndpointConnectedRef.current = false

      // Create an abort controller for this connection attempt
      const abortController = createAbortController();
      
      // Prepare the agent endpoint URL with parameters
      const searchParams = new URLSearchParams({
        channel: derivedChannelName,
      });
      
      // Add optional parameters if they exist
      if (agoraConfig.voice_id) {
        searchParams.append("voice_id", agoraConfig.voice_id);
      }
      
      if (agoraConfig.prompt) {
        searchParams.append("prompt", agoraConfig.prompt);
      }
      
      if (agoraConfig.greeting) {
        searchParams.append("greeting", agoraConfig.greeting);
      }
      
      if (agoraConfig.profile) {
        searchParams.append("profile", agoraConfig.profile);
      }
      
      const endpoint = `${agentEndpoint}/?${searchParams.toString()}`;
      console.log("Calling agent endpoint:", endpoint);
      
      const response = await fetch(endpoint, {
        signal: abortController.signal,
        method: "GET",
        mode: "cors",
        headers: {
          Accept: "application/json",
        },
      });
      
      isEndpointConnectedRef.current = true;
      const data = await response.json();
      console.log("Agent response:", data);
      
      // Extract and save agent_id from response regardless of status code
      try {
        if (data.agent_response && data.agent_response.response) {
          const responseObj = JSON.parse(data.agent_response.response);
          if (responseObj.agent_id) {
            setAgentId(responseObj.agent_id);
            console.log("Agent ID:", responseObj.agent_id);
          }
        }
      } catch (e) {
        console.error("Error parsing agent_id:", e);
      }
      
      if (data.agent_response && 
          (data.agent_response.status_code === 200 || data.agent_response.status_code === 409)) {
        // For 200 success or 409 conflict, we can proceed with connection
        // Set token and uid from response if available
        if (data.user_token) {
          result.token = data.user_token.token || result.token;
          result.uid = data.user_token.uid || result.uid;
        }
        
        showToast("Connected");
        updateConnectionState(ConnectionState.AGENT_CONNECTED);
      } else {
        // Extract error reason if available
        let errorReason = "Unknown error";
        try {
          if (data.agent_response && data.agent_response.response) {
            const responseObj = JSON.parse(data.agent_response.response);
            errorReason = responseObj.reason || responseObj.detail || "Unknown error";
          }
        } catch (e) {
          console.error("Error parsing agent response:", e);
        }
        
        console.error("Error from agent:", data);
        showToast("Failed to Connect", errorReason, true);
        result.success = false;
      }
      
      // Set user token and uid if provided
      if (data.user_token) {
        result.token = data.user_token.token || result.token;
        result.uid = data.user_token.uid || result.uid;
      }
      
      return result;
    } catch (error) {
      if (error.name === "AbortError") {
        console.log("Connection attempt cancelled by hangup or new connection request");
        return { success: false };
      }
      
      console.error("Error calling agent endpoint:", error);
      showToast("Failed to Connect", error.message, true);
      return { success: false };
    }
  }, [agoraConfig, derivedChannelName, agentEndpoint, updateConnectionState, showToast, createAbortController]);

  const disconnectAgentEndpoint = useCallback(async () => {
    // Abort active api call
    disconnectAbortController()

    // Reset agent ID
    setAgentId(null);
    
    // Send hangup request to agent endpoint if needed
    if (agentEndpoint && agentId && isEndpointConnectedRef.current) {
      try {
        const endpoint = `${agentEndpoint}/?hangup=true&agent_id=${agentId}`;
        console.log("Calling hangup endpoint:", endpoint);
        
        const response = await fetch(endpoint, {
          method: "GET",
          mode: "cors",
          headers: {
            Accept: "application/json",
          },
        });
        
        isEndpointConnectedRef.current = false
        const data = await response.json();
        console.log("Hangup response:", data);
        
        if (!(data.agent_response && data.agent_response.success)) {
          // Extract error reason if available
          let errorReason = "Unknown error";
          try {
            if (data.agent_response && data.agent_response.response) {
              const responseObj = JSON.parse(data.agent_response.response);
              errorReason = responseObj.reason || responseObj.detail || "Unknown error";
            }
          } catch (e) {
            console.error("Error parsing hangup response:", e);
          }
          
          showToast("Hangup Failed", errorReason, true);
        }
      } catch (error) {
        console.error("Error during hangup:", error);
        showToast("Hangup Failed", error.message, true);
      }
    }
    
  }, [agentEndpoint, agentId, showToast, disconnectAbortController])

  // Connect to both Agora services
  const connectToAgora = useCallback(async () => {
    
    // Set all systems to connecting state
    updateConnectionState(ConnectionState.AGORA_CONNECTING);
    updateConnectionState(ConnectionState.AGENT_CONNECTING);
    
    try {
      // Call agent endpoint to get token and uid
      const agentResult = await callAgentEndpoint();
      if (!agentResult.success) return false;
      
      const { token, uid } = agentResult;
      
      // Update Agora config with token and uid
      setAgoraConfig(prev => ({
        ...prev,
        token: token,
        uid: uid,
      }));
      
      // Connect to Agora RTC and Agora RTM
      const [rtcSuccess, rtmClient] = await Promise.all([
        agoraRTC.connectToAgoraRTC(token, uid),
        agoraRTM.connectToRtm(token, uid),
      ]);
    
      if (!rtcSuccess || !rtmClient) {
        showToast("Connection Error", "Failed to connect to Agora", true);
    
        // Disconnect RTC only if it was connected (i.e., if rtcSuccess is true)
        if (rtcSuccess) {
          await agoraRTC.disconnectFromAgoraRTC();
        }
    
        return false;
      }
    
      return true;
    } catch (error) {
      console.error("General connection error:", error);
      showToast("Connection Error", error.message, true);
      return false;
    }
  }, [
    agoraRTC, 
    agoraRTM, 
    callAgentEndpoint, 
    setAgoraConfig, 
    updateConnectionState, 
    showToast
  ]);
  
  // Disconnect from Agora services
  const disconnectFromAgora = useCallback(async () => {

    // Disconnect from Agora RTC
    await agoraRTC.disconnectFromAgoraRTC();
    
    // Disconnect from Agora RTM
    await agoraRTM.disconnectFromRtm();
    
    // 
    await disconnectAgentEndpoint()
    
  }, [agoraRTC, agoraRTM, disconnectAgentEndpoint]);
  
  return {
    // Combine and expose states and functions from both hooks
    ...agoraRTC,
    ...agoraRTM,
    agentId,
    connectToAgora,
    disconnectFromAgora
  };
}