import { useState, useCallback, useRef } from 'react';
import { ConnectionState } from "../utils/connectionState";
import { useAgoraRTC } from './useAgoraRTC';
import { useAgoraRTM } from './useAgoraRTM';
import Logger from '../utils/logger';

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
  urlParams,
  isFullyConnected // Add this parameter
}) {
  const [agentId, setAgentId] = useState(null);
  const abortControllerRef = useRef(null);
  const isEndpointConnectedRef = useRef(false);
  // Use ref to store agentEndpoint to avoid re-creation on every render
  const agentEndpointRef = useRef(agentEndpoint);
  agentEndpointRef.current = agentEndpoint;
  
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
    processAndSendMessageToAvatar,
    isFullyConnected
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
   * @param {boolean} shouldConnectAgent - Whether to connect the agent to RTC channel
   * @param {boolean} silentMode - Whether to suppress toast messages
   * @returns {Promise<Object>} - Token, UID and success status
   */
  const callAgentEndpoint = useCallback(async (shouldConnectAgent = true, silentMode = false) => {
    try {
      // Default values from config
      let result = {
        token: agoraConfig.token,
        uid: agoraConfig.uid,
        success: true
      };
      
      // Use the ref value to get the current agentEndpoint
      const currentAgentEndpoint = agentEndpointRef.current;
      
      // Early return if no agent endpoint provided
      if (!currentAgentEndpoint) {
        return result;
      }
      isEndpointConnectedRef.current = false

      // Create an abort controller for this connection attempt
      const abortController = createAbortController();
      
      // Prepare the agent endpoint URL with parameters
      const searchParams = new URLSearchParams({
        channel: derivedChannelName,
      });
      
      // Add connect=false for purechat mode
      if (!shouldConnectAgent) {
        searchParams.append("connect", "false");
      }
      
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

      // Add name parameter if it exists
      if (agoraConfig.name) {
        searchParams.append("name", agoraConfig.name);
      }

      // Use the current endpoint from config if available, otherwise use the passed one
      let endpointToUse = currentAgentEndpoint;
      if (agoraConfig.endpoint) {        
        endpointToUse = agoraConfig.endpoint;
        console.log(endpointToUse, "Agent endpoint from config");
      }     

      const endpoint = `${endpointToUse}/?${searchParams.toString()}`;
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
        
        if (shouldConnectAgent && !silentMode) {
          updateConnectionState(ConnectionState.AGENT_CONNECTED);
        } else if (shouldConnectAgent) {
          // Silent mode but still need to update state
          updateConnectionState(ConnectionState.AGENT_CONNECTED);
        }
        // In purechat mode (silentMode), we don't show toast or mark agent as connected
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
        if (!silentMode) {
          showToast("Failed to Connect", errorReason, true);
        }
        result.success = false;
      }
      
      // Set user token and uid if provided
      if (data.user_token) {
        result.token = data.user_token.token || result.token;
        result.uid = data.user_token.uid || result.uid;
        // result.channel = 
        result.agentVideo = {
          token: data.agent_video_token.token,
          uid: data.agent_video_token.uid
        }
        result.controllerEndpoint = data.controller_endpoint
      }
      
      Logger.log("Agent Endpoint Result: ", result)
      return result;
    } catch (error) {
      if (error.name === "AbortError") {
        console.log("Connection attempt cancelled by hangup or new connection request");
        return { success: false };
      }
      
      console.error("Error calling agent endpoint:", error);
      if (!silentMode) {
        showToast("Failed to Connect", error.message, true);
      }
      return { success: false };
    }
  }, [agoraConfig, derivedChannelName, updateConnectionState, showToast, createAbortController]);

  const disconnectAgentEndpoint = useCallback(async () => {
    // Abort active api call
    disconnectAbortController()

    // Reset agent ID
    setAgentId(null);
    
    // Send hangup request to agent endpoint if needed
    const currentAgentEndpoint = agentEndpointRef.current;
    if (currentAgentEndpoint && agentId && isEndpointConnectedRef.current) {
      try {
        const endpoint = `${currentAgentEndpoint}/?hangup=true&agent_id=${agentId}`;
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
    
  }, [agentId, showToast, disconnectAbortController])

  // Connect to both Agora services
  const connectToAgora = useCallback(async () => {
    
    // Set all systems to connecting state
    updateConnectionState(ConnectionState.AGORA_CONNECTING);
    updateConnectionState(ConnectionState.AGENT_CONNECTING);
    
    try {
      // Don't disconnect RTM in purechat mode - keep it alive
      // Only disconnect if we're not in purechat mode and have an RTM connection
      if (!urlParams.purechat && agoraRTM.rtmClient) {
        console.log("Disconnecting existing RTM connection before full mode connection");
        await agoraRTM.disconnectFromRtm();
      }

      agoraRTC.requestMicrophonePermission()

      // Call agent endpoint to get token and uid (with connect=true for full mode)
      const agentResult = await callAgentEndpoint(true);
      if (!agentResult.success) return false;
      
      const { token, uid, agentVideo } = agentResult;
      
      // Update Agora config with token and uid
      setAgoraConfig(prev => ({
        ...prev,
        token: token,
        uid: uid,
        agentVideo
      }));
      
      // In purechat mode, we might already have RTM connected - don't reconnect
      let rtmClient = agoraRTM.rtmClient;
      if (!rtmClient) {
        rtmClient = await agoraRTM.connectToRtm(token, uid);
      }
      
      // ALWAYS connect to Agora RTC when connecting to agent, even in purechat mode
      // This is needed for stream messages to work
      console.log("Connecting to Agora RTC for stream messages, purechat mode:", urlParams.purechat);
      const rtcSuccess = await agoraRTC.connectToAgoraRTC(token, uid);
    
      if (!rtcSuccess || !rtmClient) {
        showToast("Connection Error", "Failed to connect to Agora", true);    
        return false;
      }
    
      return true;
    } catch (error) {
      console.error("General connection error:", error);
      showToast("Connection Error", error.message, true);

      updateConnectionState(ConnectionState.AGORA_DISCONNECT);
      updateConnectionState(ConnectionState.AGENT_DISCONNECT);
      return false;
    }
  }, [
    agoraRTC, 
    agoraRTM, 
    callAgentEndpoint, 
    setAgoraConfig, 
    updateConnectionState, 
    showToast,
    urlParams.purechat
  ]);

  // Connect to RTM only for purechat mode (silent with retry)
  const connectToPureChat = useCallback(async () => {
    const maxRetries = 10;
    let retryCount = 0;
    
    const attemptConnection = async () => {
      try {
        // Call agent endpoint with connect=false to get token and uid (no toast messages)
        const agentResult = await callAgentEndpoint(false, true); // true = silent mode
        if (!agentResult.success) {
          throw new Error("Failed to get token");
        }
        
        const { token, uid } = agentResult;
        
        // Update Agora config with token and uid
        setAgoraConfig(prev => ({
          ...prev,
          token: token,
          uid: uid,
        }));
        
        // Connect to Agora RTM only (silently) - DO NOT change app connection state
        const rtmClient = await agoraRTM.connectToRtm(token, uid, true); // true = silent mode
      
        if (!rtmClient) {
          throw new Error("Failed to connect to RTM");
        }
        
        console.log("Purechat RTM connected silently");
        return true;
      } catch (error) {
        // Don't retry if it was an abort error (user cancelled)
        if (error.name === "AbortError") {
          console.log("Purechat connection attempt was cancelled");
          return false;
        }

        console.warn(`Pure chat connection attempt ${retryCount + 1} failed:`, error.message);
        retryCount++;
        
        if (retryCount < maxRetries) {
          console.log(`Retrying pure chat connection in 3 seconds... (${retryCount}/${maxRetries})`);
          
          // Wait 3 seconds before retrying
          await new Promise(resolve => setTimeout(resolve, 3000));
          return attemptConnection(); // Retry
        } else {
          console.error("Max retries reached for pure chat connection");
          showToast("Connection Error", "Failed to connect to chat after multiple attempts", true);
          return false;
        }
      }
    };
    
    return attemptConnection();
  }, [
    agoraRTM, 
    callAgentEndpoint, 
    setAgoraConfig, 
    showToast
  ]);
  
  // Disconnect from Agora services
  const disconnectFromAgora = useCallback(async () => {

    // Disconnect from Agora RTC
    await agoraRTC.disconnectFromAgoraRTC();
    
    // Only disconnect RTM if not in purechat mode
    // In purechat mode, keep RTM connected for continued chat
    if (!urlParams.purechat) {
      await agoraRTM.disconnectFromRtm();
    }
    
    // Always disconnect from agent endpoint
    await disconnectAgentEndpoint()
    
  }, [agoraRTC, agoraRTM, disconnectAgentEndpoint, urlParams.purechat]);


  const apiToSwitchVBAStreamRef = useRef();

  apiToSwitchVBAStreamRef.current = useCallback(async (eventData) => {
    try {
      const postData = {
        avatarId: eventData.avatarId,
        state: eventData.state,
        expression:  eventData.expression,
        channel: derivedChannelName,
        token:  agoraConfig.videoAgent.token,
        uid: agoraConfig.videoAgent.uid
      }

      Logger.info("Switch endpoint post data", postData)
      const response = fetch('http://localhost:3000/api/streaming/switch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(postData)
      })

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const data = await response.json();
      Logger.log('Success:', data);
    } catch (error) {
      Logger.error('Error:', error);
    }
  }, [derivedChannelName, agoraConfig])

  return {
    // Combine and expose states and functions from both hooks
    ...agoraRTC,
    ...agoraRTM,
    agentId,
    callAgentEndpoint,
    connectToAgora,
    connectToPureChat,
    disconnectFromAgora,
    apiToSwitchVBAStreamRef : apiToSwitchVBAStreamRef
  };
}