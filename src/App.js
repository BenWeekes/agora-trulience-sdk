import React, { useEffect, useRef, useState } from "react";
import AgoraRTC from "agora-rtc-sdk-ng";
import { TrulienceAvatar } from "trulience-sdk";
import "./App.css";
import { callNativeAppFunction, NativeBridge } from "./nativeBridge";

function App() {
  const nativeBridge = new NativeBridge();
  const [isConnected, setIsConnected] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");
  const [isMuted, setIsMuted] = useState(false);
  const [localAudioTrack, setLocalAudioTrack] = useState(null);

  // Agora configuration
  if (!process.env.REACT_APP_AGORA_APP_ID) {
    console.error(
      "Missing Agora App ID. Set REACT_APP_AGORA_APP_ID in your .env file"
    );
  }

  const [agoraConfig, setAgoraConfig] = useState({
    appId: process.env.REACT_APP_AGORA_APP_ID,
    channelName: process.env.REACT_APP_AGORA_CHANNEL_NAME,
    token: process.env.REACT_APP_AGORA_TOKEN || null,
    uid: process.env.REACT_APP_AGORA_UID || null,
  });

  // Trulience configuration
  const trulienceConfig = {
    avatarId: process.env.REACT_APP_TRULIENCE_AVATAR_ID,
    trulienceSDK: process.env.REACT_APP_TRULIENCE_SDK_URL,
    avatarToken: process.env.REACT_APP_TRULIENCE_AVATAR_TOKEN || null,
  };

  // We still need refs for these specific interactions with the SDKs
  const agoraClient = useRef(null);
  const trulienceAvatarRef = useRef(null);

  useEffect(() => {
    const handleAgoraDetailsUpdated = (data) => {
      const { appId, channelName, uid } = data;
      console.log(`Agora details updated: ${appId}, ${channelName}, ${uid}`);
      setAgoraConfig({...agoraConfig, appId, channelName, uid})
    };

    // Subscribe to the event
    nativeBridge.on('agoraDetailsUpdated', handleAgoraDetailsUpdated);

    // Clean up subscription on unmount
    return () => {
      nativeBridge.off('agoraDetailsUpdated', handleAgoraDetailsUpdated);
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

        // Play the audio
        user.audioTrack.play();
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
      await agoraClient.current.join(
        agoraConfig.appId,
        agoraConfig.channelName,
        agoraConfig.token,
        agoraConfig.uid
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
      {!isConnected ? (
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
      ) : (
        <div className="avatar-container">
          {/* Trulience Avatar */}
          <TrulienceAvatar
            url={trulienceConfig.trulienceSDK}
            ref={trulienceAvatarRef}
            avatarId={trulienceConfig.avatarId}
            token={trulienceConfig.avatarToken}
            eventCallbacks={eventCallbacks}
            width="100%"
            height="100%"
          />

          {/* Error or Loading overlay */}
          {errorMessage ? (
            <div className="error-overlay">
              <div>{errorMessage}</div>
            </div>
          ) : (
            loadProgress < 1 && (
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
        </div>
      )}
    </div>
  );
}

export default App;
