import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import AgoraRTC from "agora-rtc-sdk-ng";
import { TrulienceAvatar } from "trulience-sdk";
import "./App.css";
import { callNativeAppFunction, NativeBridge } from "./utils/nativeBridge";
import { initRtmClient, handleRtmMessage } from "./utils/rtmUtils";
import { generateRandomChannelName, getParamsFromUrl } from "./utils/agoraUtils";
import { AvatarView } from "./components/AvatarView";
import { ConnectButton } from "./components/ConnectButton";
import { RtmChatPanel } from "./components/RtmChatPanel";
import { Toast } from "./components/Toast";
import { ControlButtons } from "./components/ControlButtons";

function App() {
  const nativeBridge = useMemo(() => new NativeBridge(), []);
  const [isConnected, setIsConnected] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [isAvatarLoaded, setIsAvatarLoaded] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [localAudioTrack, setLocalAudioTrack] = useState(null);
  const [agentId, setAgentId] = useState(null);
  const [toast, setToast] = useState({
    visible: false,
    title: "",
    details: null,
    isError: false,
  });
  
  // RTM States
  const [rtmClient, setRtmClient] = useState(null);
  const [rtmMessages, setRtmMessages] = useState([]);
  const [rtmJoined, setRtmJoined] = useState(false);
  const [isRtmVisible, setIsRtmVisible] = useState(false);
  const [orientation, setOrientation] = useState(
    window.innerHeight > window.innerWidth ? "portrait" : "landscape"
  );
  
  const abortControllerRef = useRef(null);
  const connectionEstablishedRef = useRef(false);
  const toastTimeoutRef = useRef(null);

  const urlParams = useMemo(() => getParamsFromUrl(), []);

  // Agora configuration
  if (!process.env.REACT_APP_AGORA_APP_ID) {
    console.error(
      "Missing Agora App ID. Set REACT_APP_AGORA_APP_ID in your .env file"
    );
  }

  // Use useState with function to prevent recreating config object on each render
  const [agoraConfig, setAgoraConfig] = useState(() => ({
    appId: process.env.REACT_APP_AGORA_APP_ID,
    channelName: generateRandomChannelName(),
    token: process.env.REACT_APP_AGORA_TOKEN || null,
    uid: process.env.REACT_APP_AGORA_UID || null,
  }));

  // Agent endpoint configuration
  const agentEndpoint = process.env.REACT_APP_AGENT_ENDPOINT;

  // Trulience configuration
  const trulienceConfig = {
    avatarId: urlParams.avatarId,
    trulienceSDK: process.env.REACT_APP_TRULIENCE_SDK_URL,
    avatarToken: process.env.REACT_APP_TRULIENCE_AVATAR_TOKEN || null,
  };

  // Refs for Agora client and Trulience avatar
  const agoraClient = useRef(null);
  const trulienceAvatarRef = useRef(null);

  // Monitor window orientation changes
  useEffect(() => {
    const handleResize = () => {
      setOrientation(
        window.innerHeight > window.innerWidth ? "portrait" : "landscape"
      );
    };

    window.addEventListener("resize", handleResize);
    
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Function to show toast notification
  const showToast = (title, details = null, isError = false) => {
    // Clear any existing toast timeout
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }

    // Set the new toast
    setToast({
      visible: true,
      title,
      details,
      isError,
    });

    // Set timeout to hide toast after 3 seconds
    toastTimeoutRef.current = setTimeout(() => {
      setToast((prev) => ({ ...prev, visible: false }));
    }, 3000);
  };

  // Cleanup toast timeout on unmount
  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const handleAgoraDetailsUpdated = (data) => {
      const { appId, channelName, uid, voiceId, prompt, greeting } = data;
      console.log(
        `Agora details updated: ${appId}, ${channelName}, ${uid}, ${voiceId}, ${prompt}, ${greeting}`
      );
      setAgoraConfig({
        ...agoraConfig,
        appId,
        channelName: generateRandomChannelName(),
        uid,
        voiceId,
        prompt,
        greeting,
      });
    };

    // Subscribe to the event
    nativeBridge.on("agoraDetailsUpdated", handleAgoraDetailsUpdated);

    // Clean up subscription on unmount
    return () => {
      nativeBridge.off("agoraDetailsUpdated", handleAgoraDetailsUpdated);
    };
  }, [agoraConfig, nativeBridge]);

  // Initialize Agora client once
  useEffect(() => {
    // Create Agora client
    agoraClient.current = AgoraRTC.createClient();

    // Set up event listeners
    agoraClient.current.on("user-published", async (user, mediaType) => {
      callNativeAppFunction("agoraUserPublished");
      console.log("User published:", user.uid, mediaType, user);

      if (user.uid) {
        await agoraClient.current.subscribe(user, mediaType);
      } else {
        return;
      }

      if (mediaType === "audio" && trulienceAvatarRef.current) {
        console.log("Audio track received");
        // Directly use the audio track with the avatar
        const stream = new MediaStream([user.audioTrack.getMediaStreamTrack()]);
        trulienceAvatarRef.current.setMediaStream(stream);
      }
    });

    // Handle user unpublished event
    agoraClient.current.on("user-unpublished", (user, mediaType) => {
      callNativeAppFunction("agoraUserUnpublished", { user, mediaType });
      if (mediaType === "audio" && trulienceAvatarRef.current) {
        // Clear the media stream
        trulienceAvatarRef.current.setMediaStream(null);

        // Send commands to reset the avatar
        const trulienceObj = trulienceAvatarRef.current.getTrulienceObject();
        if (trulienceObj) {
          trulienceObj.sendMessageToAvatar(
            "<trl-stop-background-audio immediate='true' />"
          );
          trulienceObj.sendMessageToAvatar(
            "<trl-content position='DefaultCenter' />"
          );
        }
      }
    });

    agoraClient.current.on("user-joined", () => {
      callNativeAppFunction("agoraUserJoined");
    });

    agoraClient.current.on("user-left", () => {
      callNativeAppFunction("agoraUserLeft");
    });

    // Cleanup function
    return () => {
      if (agoraClient.current) {
        agoraClient.current.leave();
      }
    };
  }, []);

  // Define Trulience event callbacks
  const eventCallbacks = {
    "auth-success": (resp) => {
      console.log("Trulience Avatar auth-success:", resp);
      callNativeAppFunction("trlAuthSuccess", resp);
    },
    "auth-fail": (resp) => {
      showToast("Authentication Failed", resp.message, true);
      callNativeAppFunction("trlAuthFail", resp);
    },
    "websocket-connect": (resp) => {
      console.log("Trulience Avatar websocket-connect:", resp);
      callNativeAppFunction("trlWebsocketConnect", resp);
    },
    "load-progress": (details) => {
      setLoadProgress(details.progress);
      if (details.progress >= 1) {
        setIsAvatarLoaded(true);
      }
      callNativeAppFunction("trlLoadProgress", details);
    },
    "mic-update": () => {
      callNativeAppFunction("trlMicUpdate");
    },
    "mic-access": () => {
      callNativeAppFunction("trlMicAccess");
    },
    "speaker-update": () => {
      callNativeAppFunction("trlSpeakerUpdate");
    },
    "trl-chat": () => {
      callNativeAppFunction("trlChat");
    },
    "websocket-close": (resp) => {
      callNativeAppFunction("trlWebsocketClose", resp);
    },
    "websocket-message": (message) => {
      callNativeAppFunction("trlWebsocketMessage", message);
    },
  };

  // RTM message handler wrapper
  const handleRtmMessageCallback = useCallback((event) => {
    handleRtmMessage(event, agoraConfig.uid, setRtmMessages);
  }, [agoraConfig.uid]);

  // Connect to Agora
  const connectToAgora = useCallback(async () => {
    // Cancel any existing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    connectionEstablishedRef.current = false;
    abortControllerRef.current = new AbortController();

    // Set connected state immediately to show the avatar
    setIsConnected(true);

    try {
      let token = agoraConfig.token;
      let uid = agoraConfig.uid;

      // If agent endpoint is provided, call it to get token and uid
      if (agentEndpoint) {
        try {
          // Prepare the agent endpoint URL with all optional parameters
          const searchParams = new URLSearchParams({
            channel: agoraConfig.channelName,
          });

          if (agoraConfig.voiceId) {
            searchParams.append("voice_id", agoraConfig.voiceId);
          }

          if (agoraConfig.prompt) {
            searchParams.append("prompt", agoraConfig.prompt);
          }

          if (agoraConfig.greeting) {
            searchParams.append("greeting", agoraConfig.greeting);
          }

          const endpoint = `${agentEndpoint}/?${searchParams.toString()}`;
          console.log("Calling agent endpoint:", endpoint);

          const response = await fetch(endpoint, {
            signal: abortControllerRef.current.signal,
            method: "GET",
            mode: "cors",
            headers: {
              Accept: "application/json",
            },
          });
          connectionEstablishedRef.current = true;

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

          if (data.agent_response && data.agent_response.status_code === 200) {
            // Set token and uid from response
            token = data.user_token.token;
            uid = data.user_token.uid;

            // Show success toast
            showToast("Connected");
          } else if (
            data.agent_response &&
            data.agent_response.status_code === 409
          ) {
            // For 409 conflict errors, still show connected toast
            console.log("Task conflict detected, showing connected toast:", data);

            // Still set token and uid if available for connection
            if (data.user_token) {
              token = data.user_token.token;
              uid = data.user_token.uid;
            }

            // Show success toast even for 409 conflict
            showToast("Connected");
          } else {
            // Extract error reason if available
            let errorReason = "Unknown error";
            try {
              if (data.agent_response && data.agent_response.response) {
                const responseObj = JSON.parse(data.agent_response.response);
                errorReason =
                  responseObj.reason || responseObj.detail || "Unknown error";
              }
            } catch (e) {
              console.error("Error parsing agent response:", e);
            }

            console.error("Error from agent:", data);
            showToast("Failed to Connect", errorReason, true);
          }

          // Set user token and uid if provided, regardless of status code
          if (data.user_token) {
            token = data.user_token.token || token;
            uid = data.user_token.uid || uid;
          }
        } catch (error) {
          if (error.name === "AbortError") {
            console.log("Connection attempt cancelled by hangup or new connection request");
            return;
          }
          console.error("Error calling agent endpoint:", error);
          showToast("Failed to Connect", error.message, true);
        }
      }

      // Update Agora config to save token and uid for RTM
      setAgoraConfig(prev => ({
        ...prev,
        token: token,
        uid: uid
      }));

      // Try to join Agora channel with token and uid
      try {
        await agoraClient.current.join(
          agoraConfig.appId,
          agoraConfig.channelName,
          token,
          uid
        );

        // Create and publish microphone audio track
        const audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
        await agoraClient.current.publish([audioTrack]);

        // Save the audio track to state for mute/unmute control
        setLocalAudioTrack(audioTrack);
        
        // Initialize RTM client with the same credentials
        const rtmClientInstance = await initRtmClient(
          agoraConfig.appId, 
          uid, 
          token, 
          agoraConfig.channelName,
          handleRtmMessageCallback
        );
        
        if (rtmClientInstance) {
          setRtmClient(rtmClientInstance);
          setRtmJoined(true);
        }
      } catch (joinError) {
        console.error("Error joining Agora channel:", joinError);
        if (
          joinError.message &&
          joinError.message.includes("Permission denied")
        ) {
          showToast(
            "Connection Error",
            "Mic permission hasn't been granted",
            true
          );
          return;
        }
        showToast("Connection Error", joinError.message, true);
      }
    } catch (error) {
      console.error("General error:", error);
      showToast("Connection Error", error.message, true);
    }
  }, [agoraConfig, agentEndpoint, handleRtmMessageCallback]);

  // Handle hangup
  const handleHangup = async () => {
    // Clean up resources
    if (localAudioTrack) {
      console.log("closed audio track");
      localAudioTrack.close();
      setLocalAudioTrack(null);
    }

    // Clean up RTM
    if (rtmClient) {
      try {
        rtmClient.removeEventListener("message", handleRtmMessageCallback);
        await rtmClient.unsubscribe(agoraConfig.channelName);
        await rtmClient.logout();
        setRtmClient(null);
        setRtmJoined(false);
        setRtmMessages([]);
      } catch (rtmError) {
        console.error("Error cleaning up RTM:", rtmError);
      }
    }

    setIsConnected(false);
    setAgentId(null);
    showToast("Call Ended");
    
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    // Connection was never established so we shouldn't send a hangup
    if (!connectionEstablishedRef.current) return;

    try {
      if (agoraClient.current) {
        console.log("agora client leave");
        await agoraClient.current.leave();
      }
      
      // Early exit: cant send a valid hangup request
      if (!agentEndpoint || !agentId) return;
      
      const endpoint = `${agentEndpoint}/?hangup=true&agent_id=${agentId}`;
      console.log("Calling hangup endpoint:", endpoint);

      const response = await fetch(endpoint, {
        method: "GET",
        mode: "cors",
        headers: {
          Accept: "application/json",
        },
      });

      const data = await response.json();
      console.log("Hangup response:", data);

      if (data.agent_response && data.agent_response.success) {
        // Success, nothing to do
      } else {
        // Extract error reason if available
        let errorReason = "Unknown error";
        try {
          if (data.agent_response && data.agent_response.response) {
            const responseObj = JSON.parse(data.agent_response.response);
            errorReason =
              responseObj.reason || responseObj.detail || "Unknown error";
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
  };

  // Toggle microphone mute/unmute
  const toggleMute = () => {
    if (localAudioTrack) {
      const newMuteState = !isMuted;
      localAudioTrack.setMuted(newMuteState);
      setIsMuted(newMuteState);
    }
  };
  
  // Toggle RTM visibility
  const toggleRtmVisibility = () => {
    setIsRtmVisible(!isRtmVisible);
  };

  return (
    <div className={`app-container ${!isConnected ? "initial-screen" : ""} ${isRtmVisible ? "rtm-visible" : ""} ${orientation}`}>
      {/* Toast notification */}
      {toast.visible && (
        <Toast 
          title={toast.title} 
          details={toast.details}
          isError={toast.isError} 
        />
      )}

      <div className={`content-wrapper ${isRtmVisible ? "split-view" : ""} ${orientation}`}>
        {/* Avatar container */}
        <AvatarView
          isConnected={isConnected}
          isAvatarLoaded={isAvatarLoaded}
          loadProgress={loadProgress}
          trulienceConfig={trulienceConfig}
          trulienceAvatarRef={trulienceAvatarRef}
          eventCallbacks={eventCallbacks}
        >
          {/* Control buttons container */}
          <ControlButtons 
            isConnected={isConnected}
            isRtmVisible={isRtmVisible}
            isMuted={isMuted}
            toggleRtmVisibility={toggleRtmVisibility}
            toggleMute={toggleMute}
            handleHangup={handleHangup}
          />
        </AvatarView>

        {/* RTM Chat Panel */}
        {isConnected && isRtmVisible && (
          <RtmChatPanel
            rtmClient={rtmClient}
            rtmMessages={rtmMessages}
            rtmJoined={rtmJoined}
            agoraConfig={agoraConfig}
            agoraClient={agoraClient.current}
          />
        )}
      </div>

      {/* Connect button overlay */}
      {!isConnected && (
        <ConnectButton onClick={connectToAgora} />
      )}
    </div>
  );
}

export default App;
