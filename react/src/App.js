import React, { useEffect, useMemo, useRef, useState } from "react";
import AgoraRTC from "agora-rtc-sdk-ng";
import { TrulienceAvatar } from "trulience-sdk";
import "./App.css";
import { callNativeAppFunction, NativeBridge } from "./nativeBridge";
import './overrideFetch';

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

  // Toast timeout reference
  const toastTimeoutRef = useRef(null);

  // Generate a random 8-character string
  const generateRandomChannelName = () => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
  };

  // Get channel name and avatarId from URL query parameter if available
  const getParamsFromUrl = React.useCallback(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const channelParam = urlParams.get("channel");
      const avatarIdParam = urlParams.get("avatarId");
      
      // Generate random channel name if param is 'random'
      let channelName = process.env.REACT_APP_AGORA_CHANNEL_NAME;
      if (channelParam) {
        if (channelParam === 'random') {
          channelName = generateRandomChannelName();
          console.log(`Generated random channel name: ${channelName}`);
        } else {
          channelName = channelParam;
        }
      }
      
      // Log when avatarId is overridden from URL
      if (avatarIdParam) {
        console.log(`Using avatarId from URL: ${avatarIdParam}`);
      }
      
      return {
        channelName: channelName,
        avatarId: avatarIdParam || process.env.REACT_APP_TRULIENCE_AVATAR_ID
      };
    }
    return {
      channelName: process.env.REACT_APP_AGORA_CHANNEL_NAME,
      avatarId: process.env.REACT_APP_TRULIENCE_AVATAR_ID
    };
  }, []);

  const urlParams = useMemo(() => getParamsFromUrl(), [getParamsFromUrl]);

  // Agora configuration
  if (!process.env.REACT_APP_AGORA_APP_ID) {
    console.error(
      "Missing Agora App ID. Set REACT_APP_AGORA_APP_ID in your .env file"
    );
  }

  // Use useState with function to prevent recreating config object on each render
  const [agoraConfig, setAgoraConfig] = useState(() => ({
    appId: process.env.REACT_APP_AGORA_APP_ID,
    channelName: urlParams.channelName,
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

        // Note: We don't need to play the audio separately since
        // setMediaStream will handle audio playback through Trulience
      }
    });

    // Handle user unpublished event
    agoraClient.current.on("user-unpublished", (user, mediaType) => {
      callNativeAppFunction("agoraUserUnpublished", {user, mediaType});
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

  // Connect to Agora
  const connectToAgora = React.useCallback(async () => {
    // Set connected state immediately to show the avatar
    setIsConnected(true);
    
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
          } else if (data.agent_response && data.agent_response.status_code === 409) {
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

            // Show error toast but keep showing the avatar
            showToast("Failed to Connect", errorReason, true);
            // Continue with default values instead of returning
          }

          // Set user token and uid if provided, regardless of status code
          if (data.user_token) {
            token = data.user_token.token || token;
            uid = data.user_token.uid || uid;
          }
        } catch (error) {
          console.error("Error calling agent endpoint:", error);

          // Show error toast but keep showing the avatar
          showToast("Failed to Connect", error.message, true);
          // Continue with default values instead of returning
        }
      }

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
        
      } catch (joinError) {
        console.error("Error joining Agora channel:", joinError);
        showToast("Connection Error", joinError.message, true);
        // We don't set isConnected to false here, as we want to keep showing the avatar
      }
    } catch (error) {
      console.error("General error:", error);
      showToast("Connection Error", error.message, true);
      // We still keep the avatar visible even if there's an error
    }
  }, [agoraConfig, agentEndpoint]);

  // Handle hangup
  const handleHangup = async () => {
    if (!agentEndpoint || !agentId) {
      console.error("Cannot hangup - missing agent endpoint or agent ID");
      showToast("Hangup Failed", "Missing connection details", true);
      return;
    }

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

      const data = await response.json();
      console.log("Hangup response:", data);

      if (data.agent_response && data.agent_response.success) {
        showToast("Call Ended");
        
        // Clean up resources
        if (localAudioTrack) {
          localAudioTrack.close();
          setLocalAudioTrack(null);
        }
        
        if (agoraClient.current) {
          await agoraClient.current.leave();
        }
        
        setIsConnected(false);
        setAgentId(null);
      } else {
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
  };

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
      {/* Toast notification - moved outside avatar container to always be visible */}
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

        {/* Loading overlay - only show if connected but avatar not loaded */}
        {isConnected && !isAvatarLoaded && (
          <div className="loading-overlay">
            <div className="progress-bar">
              <div
                className="progress-indicator"
                style={{ width: `${loadProgress * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Control buttons container */}
        <div className="control-buttons">
          {/* Hangup button */}
          <button
            className="hangup-button"
            onClick={handleHangup}
            title="End call"
          >
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
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
            </svg>
          </button>

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
        </div>
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