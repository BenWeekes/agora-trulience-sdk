import React, { useEffect, useRef, useState } from "react";
import AgoraRTC from "agora-rtc-sdk-ng";
import { TrulienceAvatar } from "trulience-sdk";
import "./App.css";
import { callNativeAppFunction, NativeBridge } from "./nativeBridge";

function App() {
  const nativeBridge = new NativeBridge();
  const [isConnected, setIsConnected] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [isAvatarLoaded, setIsAvatarLoaded] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isMuted, setIsMuted] = useState(false);
  const [localAudioTrack, setLocalAudioTrack] = useState(null);
  const [toast, setToast] = useState({
    visible: false,
    title: "",
    details: null,
    isError: false,
  });

  // Toast timeout reference
  const toastTimeoutRef = useRef(null);

  // Get channel name from URL query parameter if available
  const getChannelNameFromUrl = () => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const channelParam = urlParams.get("channel");
      if (channelParam) {
        console.log("Using channel from URL:", channelParam);
        return channelParam;
      }
    }
    return process.env.REACT_APP_AGORA_CHANNEL_NAME;
  };

  // Agora configuration
  if (!process.env.REACT_APP_AGORA_APP_ID) {
    console.error(
      "Missing Agora App ID. Set REACT_APP_AGORA_APP_ID in your .env file"
    );
  }

  const [agoraConfig, setAgoraConfig] = useState({
    appId: process.env.REACT_APP_AGORA_APP_ID,
    channelName: getChannelNameFromUrl(),
    token: process.env.REACT_APP_AGORA_TOKEN || null,
    uid: process.env.REACT_APP_AGORA_UID || null,
  });

  // Agent endpoint configuration
  const agentEndpoint = process.env.REACT_APP_AGENT_ENDPOINT;

  // Trulience configuration
  const trulienceConfig = {
    avatarId: process.env.REACT_APP_TRULIENCE_AVATAR_ID,
    trulienceSDK: process.env.REACT_APP_TRULIENCE_SDK_URL,
    avatarToken: process.env.REACT_APP_TRULIENCE_AVATAR_TOKEN || null,
  };

  // We need refs for these specific interactions with the SDKs
  const agoraClient = useRef(null);
  const trulienceAvatarRef = useRef(null);

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
      const { appId, channelName, uid } = data;
      console.log(`Agora details updated: ${appId}, ${channelName}, ${uid}`);
      setAgoraConfig({ ...agoraConfig, appId, channelName, uid });
    };

    // Subscribe to the event
    nativeBridge.on("agoraDetailsUpdated", handleAgoraDetailsUpdated);

    // Clean up subscription on unmount
    return () => {
      nativeBridge.off("agoraDetailsUpdated", handleAgoraDetailsUpdated);
    };
  }, []);

  // Initialize Agora client once
  useEffect(() => {
    // Create Agora client
    agoraClient.current = AgoraRTC.createClient();

    // Set up event listeners
    agoraClient.current.on("user-published", async (user, mediaType) => {
      callNativeAppFunction("agoraUserPublished");
      console.log("User published:", user.uid, mediaType);
      await agoraClient.current.subscribe(user, mediaType);

      if (mediaType === "audio" && trulienceAvatarRef.current) {
        console.log("Audio track received");
        // Directly use the audio track with the avatar
        const stream = new MediaStream([user.audioTrack.getMediaStreamTrack()]);
        trulienceAvatarRef.current.setMediaStream(stream);

        // Note: We don't need to play the audio separately since
        // setMediaStream will handle audio playback through Trulience
      }
    });

    // Handle user unpublished event
    agoraClient.current.on("user-unpublished", (user, mediaType) => {
      callNativeAppFunction("agoraUserUnpublished");
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
      callNativeAppFunction("trlAuthSuccess");
    },
    "auth-fail": (resp) => {
      setErrorMessage(resp.message);
      callNativeAppFunction("trlAuthFail");
    },
    "websocket-connect": (resp) => {
      console.log("Trulience Avatar websocket-connect:", resp);
      callNativeAppFunction("trlWebsocketConnect");
    },
    "load-progress": (details) => {
      setLoadProgress(details.progress);
      if (details.progress >= 1) {
        setIsAvatarLoaded(true);
      }
      callNativeAppFunction("trlLoadProgress");
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
    "websocket-close": () => {
      callNativeAppFunction("trlWebsocketClose");
    },
    "websocket-message": () => {
      callNativeAppFunction("trlWebsocketMessage");
    },
  };

  // Connect to Agora
  const connectToAgora = React.useCallback(async () => {
    try {
      let token = agoraConfig.token;
      let uid = agoraConfig.uid;

      // If agent endpoint is provided, call it to get token and uid
      if (agentEndpoint) {
        try {
          const endpoint = `${agentEndpoint}/?channel=${agoraConfig.channelName}`;
          console.log("Calling agent endpoint:", endpoint);

          // Add mode: 'cors' and necessary headers to handle CORS
          const response = await fetch(endpoint, {
            method: "GET",
            mode: "cors",
            headers: {
              Accept: "application/json",
            },
          });

          const data = await response.json();

          console.log("Agent response:", data);

          if (data.agent_response && data.agent_response.status_code === 200) {
            // Set token and uid from response
            token = data.user_token.token;
            uid = data.user_token.uid;

            // Show success toast
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

            // Show error toast and set error message
            showToast("Failed to Connect", errorReason, true);
            setErrorMessage(`Failed to connect to agent: ${errorReason}`);
            return;
          }
        } catch (error) {
          console.error("Error calling agent endpoint:", error);

          // Show error toast for exceptions
          showToast("Failed to Connect", error.message, true);
          setErrorMessage(`Failed to connect to agent: ${error.message}`);
          return;
        }
      }

      // Join Agora channel with token and uid (either from env or agent response)
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
      setIsConnected(true);
    } catch (error) {
      console.error("Error joining Agora channel:", error);
      setErrorMessage(`Failed to join Agora: ${error.message}`);
      showToast("Connection Error", error.message, true);
    }
  }, [agoraConfig]);

  // Toggle microphone mute/unmute
  const toggleMute = () => {
    if (localAudioTrack) {
      const newMuteState = !isMuted;
      localAudioTrack.setMuted(newMuteState);
      setIsMuted(newMuteState);
    }
  };

  return (
    <div className={`app-container ${!isConnected ? "initial-screen" : ""}`}>
      <div className={`avatar-container ${!isConnected ? "hidden" : ""}`}>
        {/* Trulience Avatar - always render it to load in background */}
        <TrulienceAvatar
          url={trulienceConfig.trulienceSDK}
          ref={trulienceAvatarRef}
          avatarId={trulienceConfig.avatarId}
          token={trulienceConfig.avatarToken}
          eventCallbacks={eventCallbacks}
          width="100%"
          height="100%"
        />

        {/* Error or Loading overlay - only show if connected but avatar not loaded */}
        {errorMessage ? (
          <div className="error-overlay">
            <div>{errorMessage}</div>
          </div>
        ) : (
          isConnected &&
          !isAvatarLoaded && (
            <div className="loading-overlay">
              <div className="progress-bar">
                <div
                  className="progress-indicator"
                  style={{ width: `${loadProgress * 100}%` }}
                />
              </div>
            </div>
          )
        )}

        {/* Mic mute/unmute button */}
        <button
          className={`mic-toggle ${isMuted ? "muted" : ""}`}
          onClick={toggleMute}
          title={isMuted ? "Unmute microphone" : "Mute microphone"}
        >
          {isMuted ? (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              width="24"
              height="24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="1" y1="1" x2="23" y2="23"></line>
              <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"></path>
              <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"></path>
              <line x1="12" y1="19" x2="12" y2="23"></line>
              <line x1="8" y1="23" x2="16" y2="23"></line>
            </svg>
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              width="24"
              height="24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
              <line x1="12" y1="19" x2="12" y2="23"></line>
              <line x1="8" y1="23" x2="16" y2="23"></line>
            </svg>
          )}
        </button>

        {/* Toast notification */}
        {toast.visible && (
          <div
            className={`toast-notification ${
              toast.isError ? "toast-error" : "toast-success"
            }`}
          >
            <div className="toast-title">{toast.title}</div>
            {toast.details && (
              <div className="toast-details">{toast.details}</div>
            )}
          </div>
        )}
      </div>

      {/* Connect button overlay */}
      {!isConnected && (
        <div className="connect-overlay">
          <button className="connect-button" onClick={connectToAgora}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              width="24"
              height="24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
