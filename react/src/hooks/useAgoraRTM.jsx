import { useState, useCallback, useEffect, useRef } from 'react';
import { handleRtmMessage, initRtmClient } from "../utils/rtmUtils";
import { ConnectionState } from "../utils/connectionState";

/**
 * Custom hook for managing Agora RTM (Real-Time Messaging) functionality
 */
export function useAgoraRTM({
  agoraConfig,
  derivedChannelName,
  updateConnectionState,
  urlParams,
  processAndSendMessageToAvatar
}) {
  const [rtmClient, setRtmClient] = useState(null);
  const [rtmMessages, setRtmMessages] = useState([]);
  const directSendFunctionRef = useRef(null)

  // Avatar status tracking
  const prevAvatarStatusRef = useRef(null);
  const continueMessageTimeoutRef = useRef(null);

  // Determine the actual channel to use
  const getChannelName = useCallback(() => {
    // If we're connected and not in purechat mode, use the normal channel
    // If we're in purechat mode and not connected to full mode, use purechat channel
    return (urlParams.purechat && !agoraConfig.token) ? "purechat" : derivedChannelName;
  }, [urlParams.purechat, derivedChannelName, agoraConfig.token]);

  // Getter for direct send function to avoid dependency issues
  const getDirectSendRtmMessage = useCallback(() => directSendFunctionRef.current, []);


  // Register direct RTM message send function
  const registerDirectRtmSend = useCallback((sendFunction) => {
    directSendFunctionRef.current = sendFunction
    console.log("Registered direct RTM send function");
  }, []);


  // RTM message handler wrapper
  const handleRtmMessageCallback = useCallback(
    (event) => {
      console.warn('handleRtmMessageCallback', event);
      // In purechat mode AND not connected to full mode, don't process commands through the avatar
      const shouldProcessCommands = !(urlParams.purechat && !agoraConfig.token);
      const messageProcessor = shouldProcessCommands ? processAndSendMessageToAvatar : null;
      handleRtmMessage(event, agoraConfig.uid, setRtmMessages, messageProcessor);
    },
    [agoraConfig.uid, processAndSendMessageToAvatar, urlParams.purechat, agoraConfig.token]
  );

  window.clearContinueMessageTimeout = () => {
    if (continueMessageTimeoutRef.current) {
      console.warn("Clearing continue message timeout via global function");
      clearTimeout(continueMessageTimeoutRef.current);
      continueMessageTimeoutRef.current = null;
    }
  };

  // Clean up RTM when component unmounts
  useEffect(() => {
    return () => {
      if (continueMessageTimeoutRef.current) {
        clearTimeout(continueMessageTimeoutRef.current);
      }
      delete window.clearContinueMessageTimeout;
    };
  }, []);


  // Connect to Agora RTM
  const connectToRtm = useCallback(async (token, uid, silentMode = false) => {
    if (!silentMode) {
      updateConnectionState(ConnectionState.RTM_CONNECTING);
    }
    
    try {
      const channelName = getChannelName();
      console.log(`Connecting to RTM channel: ${channelName}`);
      
      const rtmClientInstance = await initRtmClient(
        agoraConfig.appId,
        uid,
        token,
        channelName,
        handleRtmMessageCallback
      );

      if (rtmClientInstance) {
        setRtmClient(rtmClientInstance);
        if (!silentMode) {
          updateConnectionState(ConnectionState.RTM_CONNECTED);
        }
        return rtmClientInstance;
      }
      
      return null;
    } catch (error) {
      console.error("Error connecting to Agora RTM:", error);
      if (!silentMode) {
        updateConnectionState(ConnectionState.RTM_DISCONNECT);
      }
      return null;
    }
  }, [agoraConfig.appId, getChannelName, handleRtmMessageCallback, updateConnectionState]);


  // Disconnect from Agora RTM
  const disconnectFromRtm = useCallback(async () => {
    if (rtmClient) {
      try {
        const channelName = getChannelName();
        rtmClient.removeEventListener("message", handleRtmMessageCallback);
        await rtmClient.unsubscribe(channelName);
        await rtmClient.logout();
        setRtmClient(null);
        updateConnectionState(ConnectionState.RTM_DISCONNECT);
        setRtmMessages([]);
        directSendFunctionRef.current = null;
        prevAvatarStatusRef.current = null;

        // Clear any scheduled continue message
        if (continueMessageTimeoutRef.current) {
          clearTimeout(continueMessageTimeoutRef.current);
          continueMessageTimeoutRef.current = null;
        }
      } catch (error) {
        console.error("Error disconnecting from RTM:", error);
      }
    }
  }, [rtmClient, getChannelName, handleRtmMessageCallback, updateConnectionState]);


  // Add a message to the RTM messages array
  const addRtmMessage = useCallback((message) => {
    setRtmMessages(prevMessages => [...prevMessages, message]);
  }, []);

  const handleContinueParamOnAvatarStatus = useCallback((resp) => {
    // Skip continue logic in purechat mode
    if (urlParams.purechat) {
      return;
    }

    const previousStatus = prevAvatarStatusRef.current?.avatarStatus;
    const continueParam = urlParams.continue;
    const hasSeenContinue = prevAvatarStatusRef.current?.continueSent || false;

    if (continueMessageTimeoutRef.current) {
      console.warn("Clearing existing continue message timeout");
      clearTimeout(continueMessageTimeoutRef.current);
    }

    const transitionedToIdle = previousStatus === 1 && resp.avatarStatus === 0;
    if (transitionedToIdle && continueParam) {
      console.warn("Scheduling continue message after status transition");
      
      // Use 200ms for first timeout, 3000ms for subsequent ones
      const timeoutDuration = hasSeenContinue ? 3000 : 200;
      
      console.warn(`Using timeout duration: ${timeoutDuration}ms (${hasSeenContinue ? 'subsequent' : 'first'} time)`);
      
      continueMessageTimeoutRef.current = setTimeout(() => {
        const sendDirect = getDirectSendRtmMessage();
        if (sendDirect) {
          sendDirect(continueParam, true)
            .then(success => {
              console.warn("Continue message sent:", success);
              // Mark that we've sent the continue message
              prevAvatarStatusRef.current = { 
                ...prevAvatarStatusRef.current,
                continueSent: true 
              };
            })
            .catch(err => console.error("Continue message error:", err));
        } else {
          console.error("Direct send function unavailable");
        }
        continueMessageTimeoutRef.current = null;
      }, timeoutDuration);
    }

    // Store the avatar status
    prevAvatarStatusRef.current = {
      ...(prevAvatarStatusRef.current || {}),
      avatarStatus: resp.avatarStatus
    };
  }, [getDirectSendRtmMessage, urlParams]);

  return {
    rtmClient,
    rtmMessages,
    getDirectSendRtmMessage,
    registerDirectRtmSend,
    connectToRtm,
    disconnectFromRtm,
    addRtmMessage,
    setRtmMessages,
    handleContinueParamOnAvatarStatus
  };
}