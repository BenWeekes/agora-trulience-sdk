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
  const [directSendFunction, setDirectSendFunction] = useState(null);

  // Avatar status tracking
  const prevAvatarStatusRef = useRef(null);
  const continueMessageTimeoutRef = useRef(null);

  // Getter for direct send function to avoid dependency issues
  const getDirectSendRtmMessage = useCallback(() => directSendFunction, [directSendFunction]);


  // Register direct RTM message send function
  const registerDirectRtmSend = useCallback((sendFunction) => {
    setDirectSendFunction(() => sendFunction);
    console.log("Registered direct RTM send function");
  }, []);


  // RTM message handler wrapper
  const handleRtmMessageCallback = useCallback(
    (event) => {
      // Pass the processAndSendMessageToAvatar function to handle any commands
      handleRtmMessage(event, agoraConfig.uid, setRtmMessages, processAndSendMessageToAvatar );
    },
    [agoraConfig.uid, processAndSendMessageToAvatar ]
  );


  // Clean up RTM when component unmounts
  useEffect(() => {
    return () => {
      if (continueMessageTimeoutRef.current) {
        clearTimeout(continueMessageTimeoutRef.current);
      }
    };
  }, []);


  // Connect to Agora RTM
  const connectToRtm = useCallback(async (token, uid) => {
    updateConnectionState(ConnectionState.RTM_CONNECTING);
    
    try {
      const rtmClientInstance = await initRtmClient(
        agoraConfig.appId,
        uid,
        token,
        derivedChannelName,
        handleRtmMessageCallback
      );

      if (rtmClientInstance) {
        setRtmClient(rtmClientInstance);
        updateConnectionState(ConnectionState.RTM_CONNECTED);
        return rtmClientInstance;
      }
      
      return null;
    } catch (error) {
      console.error("Error connecting to Agora RTM:", error);
      updateConnectionState(ConnectionState.RTM_DISCONNECT);
      return null;
    }
  }, [agoraConfig.appId, derivedChannelName, handleRtmMessageCallback, updateConnectionState]);


  // Disconnect from Agora RTM
  const disconnectFromRtm = useCallback(async () => {
    if (rtmClient) {
      try {
        rtmClient.removeEventListener("message", handleRtmMessageCallback);
        await rtmClient.unsubscribe(derivedChannelName);
        await rtmClient.logout();
        setRtmClient(null);
        updateConnectionState(ConnectionState.RTM_DISCONNECT);
        setRtmMessages([]);
        setDirectSendFunction(null);
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
  }, [rtmClient, derivedChannelName, handleRtmMessageCallback, updateConnectionState]);


  // Add a message to the RTM messages array
  const addRtmMessage = useCallback((message) => {
    setRtmMessages(prevMessages => [...prevMessages, message]);
  }, []);

  const handleContinueParamOnAvatarStatus = useCallback((resp) => {
    const previousStatus = prevAvatarStatusRef.current;
    const continueParam = urlParams.continue;

    if (continueMessageTimeoutRef.current) {
      console.log("Clearing existing continue message timeout");
      clearTimeout(continueMessageTimeoutRef.current);
    }

    const transitionedToIdle = previousStatus === 1 && resp.avatarStatus === 0;
    if (transitionedToIdle && continueParam) {
      console.log("Scheduling continue message after status transition");
      continueMessageTimeoutRef.current = setTimeout(() => {
        const sendDirect = getDirectSendRtmMessage();
        if (sendDirect) {
          sendDirect(continueParam, true)
            .then(success => console.log("Continue message sent:", success))
            .catch(err => console.error("Continue message error:", err));
        } else {
          console.error("Direct send function unavailable");
        }
        continueMessageTimeoutRef.current = null;
      }, 2000);
    }

    prevAvatarStatusRef.current = resp.avatarStatus;
  }, [getDirectSendRtmMessage, urlParams, prevAvatarStatusRef, continueMessageTimeoutRef]);

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