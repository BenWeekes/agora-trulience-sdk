// Updated App.js with centralized command processing
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import AgoraRTC from "agora-rtc-sdk-ng";
import "./App.css";
import { callNativeAppFunction, NativeBridge } from "./utils/nativeBridge";
import { initRtmClient, handleRtmMessage } from "./utils/rtmUtils";
import {
  generateRandomChannelName,
  getParamsFromUrl,
} from "./utils/agoraUtils";
import { AvatarView } from "./components/AvatarView";
import { ConnectButton } from "./components/ConnectButton";
import { RtmChatPanel } from "./components/RtmChatPanel";
import { ControlButtons } from "./components/ControlButtons";
import { InitialLoadingIndicator } from "./components/InitialLoadingIndicator";

// Set of processed commands to prevent duplicates
const processedCommands = new Set();

/**
 * Finds all Trulience commands in a text string
 * This handles both standalone commands and commands embedded in text
 * 
 * @param {string} text - Text to search for commands
 * @returns {string[]} Array of found commands
 */
const findTrulienceCommands = (text) => {
  if (!text || typeof text !== 'string') return [];
  
  const result = [];
  let startIndex = text.indexOf("<trl");
  
  while (startIndex >= 0) {
    // Find the end of this command
    const selfClosingEnd = text.indexOf("/>", startIndex);
    const openingTagEnd = text.indexOf(">", startIndex);
    
    // Determine what kind of tag this is and where it ends
    if (selfClosingEnd >= 0 && (openingTagEnd < 0 || selfClosingEnd < openingTagEnd + 1)) {
      // It's a self-closing tag
      result.push(text.substring(startIndex, selfClosingEnd + 2));
      startIndex = text.indexOf("<trl", selfClosingEnd);
    } else if (openingTagEnd >= 0) {
      // It's an opening tag, find its closing tag
      const tagName = text.substring(startIndex + 1, text.indexOf(" ", startIndex) || openingTagEnd);
      const closingTag = "</" + tagName + ">";
      const closingTagIndex = text.indexOf(closingTag, openingTagEnd);
      
      if (closingTagIndex >= 0) {
        result.push(text.substring(startIndex, closingTagIndex + closingTag.length));
        startIndex = text.indexOf("<trl", closingTagIndex);
      } else {
        // No closing tag found, must be malformed
        startIndex = text.indexOf("<trl", openingTagEnd);
      }
    } else {
      // Malformed tag, move on
      startIndex = text.indexOf("<trl", startIndex + 1);
    }
  }
  
  return result;
};

/**
 * Process message for commands and returns processed message
 * 
 * @param {string} message - Original message text
 * @param {function} commandHandler - Function to handle extracted commands
 * @param {string|number} contextId - Context ID for deduplication (e.g., turn_id)
 * @returns {string} Processed message with commands removed
 */
function processMessageCommands(message, commandHandler, contextId = "") {
  if (!message || typeof message !== 'string' || !commandHandler) {
    return message;
  }
  
  // Find all commands in the message
  const commands = findTrulienceCommands(message);
  if (commands.length === 0) {
    return message;
  }
  
  // Process each command
  let cleanedText = message;
  commands.forEach(command => {
    const commandKey = `${contextId}-${command}`;
    
    // Only process if not seen before
   // if (!processedCommands.has(commandKey)) {
      commandHandler(command);
   //   processedCommands.add(commandKey);
   // }
    
    // Remove the command from the text
    cleanedText = cleanedText.replace(command, '');
  });
  
  return cleanedText.trim();
}

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

  // New state for application initial loading
  const [isAppLoading, setIsAppLoading] = useState(true);
  const [agoraConnecting, setAgoraConnecting] = useState(false);

  // RTM States
  const [rtmClient, setRtmClient] = useState(null);
  const [rtmMessages, setRtmMessages] = useState([]);
  const [rtmJoined, setRtmJoined] = useState(false);
  // Always show RTM by default
  const [isRtmVisible, setIsRtmVisible] = useState(true);
  const [orientation, setOrientation] = useState(
    window.innerHeight > window.innerWidth ? "portrait" : "landscape"
  );

  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState(false);

  const abortControllerRef = useRef(null);
  const connectionEstablishedRef = useRef(false);
  const toastTimeoutRef = useRef(null);

  const urlParams = useMemo(() => getParamsFromUrl(), []);

  // Simulate initial app loading
  useEffect(() => {
    // Set a timeout to simulate resource loading
    const timer = setTimeout(() => {
      setIsAppLoading(false);
    }, 1500); // Adjust the time as needed based on your actual loading time

    return () => clearTimeout(timer);
  }, []);

  // Agora configuration
  if (!process.env.REACT_APP_AGORA_APP_ID) {
    console.error(
      "Missing Agora App ID. Set REACT_APP_AGORA_APP_ID in your .env file"
    );
  }

  // Use useState with function to prevent recreating config object on each render
  const [agoraConfig, setAgoraConfig] = useState(() => ({
    appId: process.env.REACT_APP_AGORA_APP_ID,
    channelName:
      urlParams.channelName ?? process.env.REACT_APP_AGORA_CHANNEL_NAME,
    token: process.env.REACT_APP_AGORA_TOKEN || null,
    uid: process.env.REACT_APP_AGORA_UID || null,
    voice_id: urlParams.voice_id || null, // Use consistent naming
    prompt: urlParams.prompt || null,
    greeting: urlParams.greeting || null,
    profile: urlParams.profile || null,
  }));

  const derivedChannelName = useMemo(() => {
    if (agoraConfig.channelName === "random") {
      return generateRandomChannelName();
    }
    return agoraConfig.channelName;
  }, [agoraConfig.channelName]);

  // Agent endpoint configuration
  const agentEndpoint = process.env.REACT_APP_AGENT_ENDPOINT;

  // Trulience configuration
  const [trulienceConfig, setTrulienceConfig] = useState(() => ({
    avatarId: urlParams.avatarId ?? process.env.REACT_APP_TRULIENCE_AVATAR_ID,
    trulienceSDK: process.env.REACT_APP_TRULIENCE_SDK_URL,
    avatarToken: process.env.REACT_APP_TRULIENCE_AVATAR_TOKEN || null,
  }));

  // Refs for Agora client and Trulience avatar
  const agoraClient = useRef(null);
  const trulienceAvatarRef = useRef(null);

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
    "avatar-status-update": (resp) => {
      console.log("AvatarStatus", resp.avatarStatus)
    }
  };

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

  // Toggle fullscreen mode
  const toggleFullscreen = () => {
    // If we're entering fullscreen mode, hide the RTM panel
    if (!isFullscreen) {
      setIsRtmVisible(false);
    } else {
      // When exiting fullscreen, show the RTM panel again
      setIsRtmVisible(true);
    }
    setIsFullscreen(!isFullscreen);
  };

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
      const { appId, channelName, uid, voice_id, prompt, greeting, profile } = data;
      console.log(
        `Agora details updated: ${appId}, ${channelName}, ${uid}, ${voice_id}, ${prompt}, ${greeting}, ${profile}`
      );
      setAgoraConfig({
        ...agoraConfig,
        appId,
        channelName,
        uid,
        voice_id,
        prompt,
        greeting,
        profile
      });
    };

    // Subscribe to the event
    nativeBridge.on("agoraDetailsUpdated", handleAgoraDetailsUpdated);

    // Clean up subscription on unmount
    return () => {
      nativeBridge.off("agoraDetailsUpdated", handleAgoraDetailsUpdated);
    };
  }, [agoraConfig, nativeBridge]);

  useEffect(() => {
    const handleTrulienceDetailsUpdated = (data) => {
      const { avatarId } = data;
      console.log(`Trulience details updated: ${avatarId}`);
      setTrulienceConfig({
        ...trulienceConfig,
        avatarId,
      });
    };

    // Subscribe to the event
    nativeBridge.on("trulienceDetailsUpdated", handleTrulienceDetailsUpdated);

    // Clean up subscription on unmount
    return () => {
      nativeBridge.off(
        "trulienceDetailsUpdated",
        handleTrulienceDetailsUpdated
      );
    };
  }, [trulienceConfig, nativeBridge]);

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

  // Function to send message to Trulience avatar
  const sendMessageToAvatar = useCallback((message) => {
    if (trulienceAvatarRef.current) {
      const trulienceObj = trulienceAvatarRef.current.getTrulienceObject();
      if (trulienceObj) {
        console.log("Sending message to Trulience avatar:", message);
        trulienceObj.sendMessageToAvatar(message);
        return true;
      } else {
        console.warn("Trulience object not available yet");
      }
    } else {
      console.warn("Trulience avatar ref not available");
    }
    return false;
  }, []);

  // Process message and handle any commands
  const processMessage = useCallback((message, contextId = "") => {
    return processMessageCommands(message, sendMessageToAvatar, contextId);
  }, [sendMessageToAvatar]);

  // RTM message handler wrapper
  const handleRtmMessageCallback = useCallback(
    (event) => {
      // Pass the processMessage function to handle any commands
      handleRtmMessage(event, agoraConfig.uid, setRtmMessages, processMessage);
    },
    [agoraConfig.uid, processMessage]
  );

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
    setAgoraConnecting(true)

    // Create and publish microphone audio track
    const audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
    // Save the audio track to state for mute/unmute control
    setLocalAudioTrack(audioTrack);
    try {
      let token = agoraConfig.token;
      let uid = agoraConfig.uid;

      // If agent endpoint is provided, call it to get token and uid
      if (agentEndpoint) {
        try {
          // Prepare the agent endpoint URL with all optional parameters
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

          setAgoraConnecting(false)
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
            console.log(
              "Task conflict detected, showing connected toast:",
              data
            );

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
            console.log(
              "Connection attempt cancelled by hangup or new connection request"
            );
            return;
          }
          console.error("Error calling agent endpoint:", error);
          showToast("Failed to Connect", error.message, true);
          setAgoraConnecting(false)
        }
      }

      // Update Agora config to save token and uid for RTM
      setAgoraConfig((prev) => ({
        ...prev,
        token: token,
        uid: uid,
      }));

      // Try to join Agora channel with token and uid
      try {
        await agoraClient.current.join(
          agoraConfig.appId,
          derivedChannelName,
          token,
          uid
        );

        await agoraClient.current.publish([audioTrack]);

        // Initialize RTM client with the same credentials
        const rtmClientInstance = await initRtmClient(
          agoraConfig.appId,
          uid,
          token,
          derivedChannelName,
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
          setAgoraConnecting(false)
          return;
        }
        showToast("Connection Error", joinError.message, true);
      }
    } catch (error) {
      console.error("General error:", error);
      showToast("Connection Error", error.message, true);
    }

    setAgoraConnecting(false)
  }, [
    agoraConfig,
    agentEndpoint,
    handleRtmMessageCallback,
    derivedChannelName,
  ]);

  // Handle hangup
  const handleHangup = async () => {
    // Send commands to reset the avatar
    if (trulienceAvatarRef.current) {
      const trulienceObj = trulienceAvatarRef.current.getTrulienceObject();
      if (trulienceObj) {
        trulienceObj.sendMessageToAvatar(
          "<trl-stop-background-audio immediate='true' />"
        );
        trulienceObj.sendMessageToAvatar(
          "<trl-content position='DefaultCenter' />"
        );
        console.log("Reset avatar state on hangup");
      }
    }

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
        await rtmClient.unsubscribe(derivedChannelName);
        await rtmClient.logout();
        setRtmClient(null);
        setRtmJoined(false);
        setRtmMessages([]);
      } catch (rtmError) {
        console.error("Error cleaning up RTM:", rtmError);
      }
    }

    // Reset connection state
    setIsConnected(false);
    setAgentId(null);

    // Exit fullscreen mode if active
    if (isFullscreen) {
      setIsFullscreen(false);
      setIsRtmVisible(true);
    }

    // showToast("Call Ended");

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

  // Show initial loading screen if the app is still loading
  if (isAppLoading) {
    return <InitialLoadingIndicator />;
  }

  // Return the main application UI
  return (
    <div
      className={`app-container ${!isConnected ? "initial-screen" : ""} ${
        isRtmVisible && !isFullscreen ? "rtm-visible" : ""
      } ${orientation}`}
    >
      {/* Content wrapper - always in split view unless fullscreen */}
      <div
        className={`content-wrapper ${
          !isFullscreen ? "split-view" : ""
        } ${orientation}`}
      >
        {/* Avatar container - now with integrated toast */}
        <AvatarView
          isConnected={isConnected}
          isAvatarLoaded={isAvatarLoaded}
          loadProgress={loadProgress}
          trulienceConfig={trulienceConfig}
          trulienceAvatarRef={trulienceAvatarRef}
          eventCallbacks={eventCallbacks}
          isFullscreen={isFullscreen}
          toggleFullscreen={toggleFullscreen}
          toast={toast.visible ? toast : null} // Pass toast data to avatar view
        >
          {/* Direct connect button rendering when not connected */}
          {!isConnected ? (
            <ConnectButton onClick={connectToAgora} />
          ) : (
            <ControlButtons
              isConnected={isConnected}
              isMuted={isMuted}
              toggleMute={toggleMute}
              handleHangup={handleHangup}
            />
          )}

          { agoraConnecting && isAvatarLoaded && (
            <div className="spinner-container">
              <div className="spinner" />
            </div>
          )}
        </AvatarView>

        {/* RTM Chat Panel - always visible unless in fullscreen mode */}
          <RtmChatPanel
            rtmClient={rtmClient}
            rtmMessages={rtmMessages}
            rtmJoined={rtmJoined}
            agoraConfig={agoraConfig}
            agoraClient={agoraClient.current}
            isConnected={isConnected}
            processMessage={processMessage}
            isFullscreen={isFullscreen}
          />
      </div>
    </div>
  );
}

export default App;