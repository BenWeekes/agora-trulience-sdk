import React, {
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState,
} from "react";
import "./App.css";
import "./skins/WhatsApp.css";
import "./skins/Dating.css";
import "./skins/TeamsDark.css";
import "./skins/FaceTime.css";
import { AvatarView } from "./components/AvatarView";
import ContentViewer from "./components/ContentView";
import { ControlButtons } from "./components/ControlButtons";
import { RtmChatPanel } from "./components/RtmChatPanel";
import { Toast, useToast } from "./components/Toast";
import { useAgoraConnection } from "./hooks/useAgoraConnection";
import { useAppConfig } from "./hooks/useAppConfig";
import { useContentManager } from "./hooks/useContentManager";
import useOrientationListener from "./hooks/useOrientationListener";
import useTrulienceAvatarManager from "./hooks/useTrulienceAvatarManager";
import { connectionReducer, ConnectionState, initialConnectionState, checkIfFullyConnected } from "./utils/connectionState";
import ConnectScreen from "./components/ConnectScreen";
import useLayoutState from "./hooks/useLayoutState";
import useKeyboardAwareAvatarPosition from "./hooks/useKeyboardAwareAvatarPosition";
import logger from "./utils/logger";


function App() {
  const [connectionState, updateConnectionState] = useReducer(connectionReducer, initialConnectionState)
  const isConnectInitiated = connectionState.app.connectInitiated;
  const isAppConnected = checkIfFullyConnected(connectionState)

  const [loadProgress, setLoadProgress] = useState(0);

  // Utils
  const { toast, showToast } = useToast();
  const orientation = useOrientationListener()
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Always show RTM by default
  const [isRtmVisible, setIsRtmVisible] = useState(true);

  // Agent endpoint configuration
  const agentEndpoint = process.env.REACT_APP_AGENT_ENDPOINT;

  // Refs for Agora client and Trulience avatar
  const agoraClient = useRef(null);


  // App-level config and derived values for initializing Trulience and Agora
  const {
    urlParams,
    agoraConfig,
    setAgoraConfig,
    trulienceConfig,
    derivedChannelName,
  } = useAppConfig();

  // Check if we're in purechat mode
  const isPureChatMode = urlParams.purechat === true;

  // Get the skin type (default to whatsapp)
  const skinType = urlParams.skin || "whatsapp";

  logger.log("Connection state:", {
    isPureChatMode,
    isAppConnected,
    derivedChannelName,
    skinType,
    connectionState: {
      avatar: connectionState.avatar.wsConnected,
      agent: connectionState.agent.connected,
      agora: connectionState.agora.connected
    }
  });

  /** Prevent avatar from disappearing off the top of the screen when the keyboard is opened  */
  useKeyboardAwareAvatarPosition("main-video-container", (visibleHeight) => {
    const element = document.getElementById("main-section")
    if (element) {
      element.style.height = `${visibleHeight}px`
      element.style.minHeight = `${visibleHeight}px`
    }
  })
  
  // Manage Trulience avatar lifecycle and messaging
  const {
    avatarEventHandlers,
    processAndSendMessageToAvatar,
    resetAvatarToDefault,
    trulienceAvatarRef,
    connectAvatar,
    setParamAndPreloadAvatar,
    disconnectAvatar,
    isSpeakerMuted,
    toggleSpeaker
  } = useTrulienceAvatarManager({
    showToast,
    setLoadProgress,
    updateConnectionState,
    eventHandler: {
      "avatar-status-update": (data) => {
        agoraConnection.handleContinueParamOnAvatarStatus(data)
      },
      "websocket-close" : () => {
        handleHangup()
      },
      "vba-switch" : (eventData) => {
        logger.info("vba-switch event", eventData) 
        agoraConnection.apiToSwitchVBAStreamRef.current(eventData)
      },
      "avatar-streaming": (eventData) => {
        if(eventData.ready) {
          updateConnectionState(ConnectionState.AVATAR_STREAM_READY)
        }
      }
    }
  })

  // Initialize Agora connection hook
  const agoraConnection = useAgoraConnection({
    agoraConfig,
    setAgoraConfig,
    derivedChannelName,
    agentEndpoint,
    updateConnectionState,
    processAndSendMessageToAvatar,
    showToast,
    agoraClientRef: agoraClient,
    urlParams,
    trulienceAvatarRef,
    isFullyConnected: isAppConnected,
    connectionState
  });

  
  // Manage content display state and related data
  const contentManager = useContentManager(isConnectInitiated);


  // remove preload screen
  useEffect(() => {
    let timer = null;
    updateConnectionState(ConnectionState.APP_LOADED)
    const loader = document.getElementById('preloader');
    if (loader) {
      loader.style.display = 'none'
      timer = setTimeout(() => loader.remove(), 300);
    }
    return () => clearTimeout(timer);
  }, []);

  // Auto-connect for purechat mode (silent, no loading indicators)
  const pureChatConnectionAttempted = useRef(false);
  
  useEffect(() => {
    const shouldConnect = connectionState.app.loaded && 
                         isPureChatMode && 
                         !isConnectInitiated && 
                         !pureChatConnectionAttempted.current;

    if (shouldConnect) {
      logger.log("Auto-connecting purechat mode (silent) - RTM only, no UI change");
      pureChatConnectionAttempted.current = true;
      
      agoraConnection.connectToPureChat().catch((error) => {
        logger.error("Purechat connection failed:", error);
        // Reset the flag on failure so it can be retried later
        pureChatConnectionAttempted.current = false;
      });
    }

    // Reset the flag when not in purechat mode or when disconnected
    if (!isPureChatMode || !connectionState.app.loaded) {
      pureChatConnectionAttempted.current = false;
    }
  }, [connectionState.app.loaded, isPureChatMode, isConnectInitiated, agoraConnection]);


  // Play the video after app is connected
  useEffect(() => {
    if (urlParams.contentType && urlParams.contentURL) {
      contentManager.setContentData({
        type: urlParams.contentType,
        url: urlParams.contentURL,
        alt: urlParams.contentALT || "Content"
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlParams, ]);

  useEffect(() => {
    if (isAppConnected && urlParams.contentType && urlParams.contentURL) {
      contentManager.showContentAndPlayVideo()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlParams, isAppConnected, contentManager.playVideo]);


  // Use Effect for sending video token to the Trulience for Video switch
  useEffect(() => {
    // connect only after avatar is ready to preload
    if(derivedChannelName && connectionState.avatar.ready) {
      preloadAvatarWithAgentToken()
    }
  }, [derivedChannelName, connectionState.avatar.ready])


  const preloadAvatarWithAgentToken = async () => {
    try {
      // Call agent endpoint with connect=false to get token and uid
      const agentResult = await agoraConnection?.callAgentEndpoint(false, true); // true = silent mode
      if (!agentResult.success) {
        throw new Error("Failed to get token");
      }
      logger.log("connect Agent Endpoint with connect=false", agentResult)
      updateConnectionState(ConnectionState.AGENT_READY)
      if(agentResult.controllerEndpoint) {
        setParamAndPreloadAvatar({
          AgoraConfig: {
            Enable: true,
            Channel: derivedChannelName,
            Controller: agentResult.controllerEndpoint,
            Token:  agentResult.agentVideo.token,
            SERVER_ID: agentResult.agentVideo.uid,
            CLIENT_ID: "client" ?? agoraClient.current.uid ?? null
          }
        })
      }
      updateConnectionState(ConnectionState.APP_READY_TO_CONNECT)
      
    } catch (error) {
      logger.error("Error while connecting to agent", error)
    }
  }

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

  // Connect Function for normal mode
  const connectAgoraTrulience = useCallback(async () => {
    // Set app connected state immediately to show the avatar UI
    updateConnectionState(ConnectionState.APP_CONNECT_INITIATED);
    
    if (urlParams.contentType && urlParams.contentURL) {
      contentManager.unlockVideo(); // To fix auto play on iOS
    }

    // connect trulience avatar
    connectAvatar()
    
    // connect Agora
    const result = await agoraConnection.connectToAgora()
    if(!result) {
      handleHangup()
    }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agoraConnection, urlParams.contentType, connectionState.agent.ready]);

  // Connect Function for purechat mode
  // eslint-disable-next-line no-unused-vars
  const connectPureChat = useCallback(async () => {
    // Set app connected state immediately to show the chat UI
    updateConnectionState(ConnectionState.APP_CONNECT_INITIATED);
    
    // Connect to RTM only
    const result = await agoraConnection.connectToPureChat()
    
    if(!result) {
      handleHangup()
    }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agoraConnection]);

  
  // Handle hangup
  const handleHangup = async () => {
    updateConnectionState(ConnectionState.DISCONNECTING);
    
    contentManager.hideContent()

    // Send commands to reset the avatar (only in normal mode)
    if (!isPureChatMode) {
      resetAvatarToDefault()
    }

    // Disconnect from all Agora services
    await agoraConnection.disconnectFromAgora();
    disconnectAvatar()

    updateConnectionState(ConnectionState.DISCONNECT);
    
    // TODO: This is work around due to the limitation trulience avatar - does emit event after media server disconnect
    setTimeout(() => {
      updateConnectionState(ConnectionState.APP_READY_TO_CONNECT)
    }, 2000)

    // Exit fullscreen mode if active
    if (isFullscreen) {
      setIsFullscreen(false);
      setIsRtmVisible(true);
    }
    
  };

  const layoutState = useLayoutState(contentManager, urlParams, orientation);
  const { isMobileView, isContentLayoutWide, isContentLayoutDefault, isAvatarOverlay, isContentLayoutWideOverlay } = layoutState;

  // Loading screen will be shown till we set loading true
  if (connectionState.app.loading) {
    return null;
  }


  const appContainerClasses = [
    "app-container",
    `${skinType}-skin`,
    !isConnectInitiated && "initial-screen",
    isRtmVisible && !isFullscreen && "rtm-visible",
    orientation,
    isAvatarOverlay && "avatar-over-content",
  ].filter(Boolean).join(" ");

  const leftSectionStyle = {
    width:
      isContentLayoutWideOverlay || isMobileView
        ? "100%"
        : isContentLayoutWide
        ? "50%"
        : undefined,
    height: isContentLayoutWideOverlay ? "50%" : undefined,
    position: "relative",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    
  };

  const avatarWrapperStyle = {
    position: isAvatarOverlay
      ? "relative"
      : isMobileView ? "unset" : "relative",
    width:
      (isContentLayoutWideOverlay && isAvatarOverlay) || (isAvatarOverlay && isMobileView)
        ? "fit-content"
        : "100%",
    height:
      !isContentLayoutWideOverlay && isAvatarOverlay && !isMobileView
        ? "fit-content"
        : "100%",
    };

  return (
    <div className={appContainerClasses} >
      {/* This content view will be display when contentLayout is wide */}
      {isContentLayoutWide && (
        <ContentViewer
          contentData={contentManager.contentData}
          style={{ height: "50vh", width: "100vw", position: "relative" }}
        />
      )}

      {/* Content wrapper - always in split view unless fullscreen */}
      <div
        className={
          `content-wrapper ${!isFullscreen ? "split-view" : ""} ${orientation}`
        }
        style={{
          flexDirection:
            isContentLayoutWideOverlay || isMobileView ? "column" : "row",
        }}
      >
        <div
          id="main-section"
          className={`left-section`}
          style={leftSectionStyle}
        >
          <div 
            id="main-video-container" 
            style={{ 
              height: "100%",
              width: "100%",
              display: "flex",
              justifyContent: "center",
              alignItems: "center"
            }}
          >

          {!isAppConnected && (
            <ConnectScreen
              avatarId={trulienceConfig.avatarId}
              isPureChatMode={isPureChatMode}
              connectionState={connectionState}
              onConnect={connectAgoraTrulience}
              onHangUp={handleHangup}
              ringtone={urlParams.ringtone ?? true}
            />
          )}

          {/* Toast notification - placed inside avatar container */}
          <Toast {...toast} />

          <div style={avatarWrapperStyle} >
            {/* Content container - shown when content mode is active */}
            <ContentViewer
              contentData={contentManager.contentData}
              style={{
                height: isAvatarOverlay && "100%",
                display: isContentLayoutDefault && isAppConnected ? "flex" : "none"
              }}
            />

            {/* Avatar container wrapper */}
            <div
              className={`avatar-container-wrapper ${
                isAvatarOverlay || (isContentLayoutDefault && isMobileView)
                  ? "floating"
                  : ""
              }`}
              style={{
                height:
                  isContentLayoutDefault && !isAvatarOverlay && !isMobileView
                    ? "50%"
                    : isAvatarOverlay && urlParams.avatarOverlayHeight ? `${urlParams.avatarOverlayHeight}px` : undefined,
                width: isAvatarOverlay && urlParams.avatarOverlayWidth ? `${urlParams.avatarOverlayWidth}px` : undefined,
                bottom: isAvatarOverlay && urlParams.avatarOverlayBottom !== undefined ? `${urlParams.avatarOverlayBottom}px` : undefined,
                right: isAvatarOverlay && urlParams.avatarOverlayRight !== undefined ? `${urlParams.avatarOverlayRight}px` : undefined
              }}
            >
              <AvatarView
                isAppConnected={isAppConnected}
                isConnectInitiated={isConnectInitiated}
                isAvatarLoaded={connectionState.avatar.loaded}
                loadProgress={loadProgress}
                trulienceConfig={trulienceConfig}
                trulienceAvatarRef={trulienceAvatarRef}
                eventCallbacks={avatarEventHandlers}
                isFullscreen={isFullscreen}
                toggleFullscreen={toggleFullscreen}
                toast={toast.visible ? toast : null}
                isPureChatMode={isPureChatMode}
              >
                {/* Direct connect button rendering when not connected */}
                {isAppConnected && (
                  // Always show control buttons when connected, regardless of purechat mode
                  <ControlButtons
                    isConnectInitiated={isConnectInitiated}
                    isMuted={agoraConnection.isMuted}
                    toggleMute={agoraConnection.toggleMute}
                    isSpeakerMuted={isSpeakerMuted}
                    toggleSpeaker={toggleSpeaker}
                    handleHangup={handleHangup}
                  />
                )}
              </AvatarView>
            </div>
            </div>
          </div>
        </div>

        {/* RTM Chat Panel - always visible unless in fullscreen mode */}
        <RtmChatPanel
          rtmClient={agoraConnection.rtmClient}
          rtmMessages={agoraConnection.rtmMessages}
          rtmJoined={connectionState.rtm.connected}
          agoraConfig={agoraConfig}
          agoraClient={agoraClient.current}
          isConnectInitiated={isConnectInitiated}
          processMessage={processAndSendMessageToAvatar}
          isFullscreen={isFullscreen}
          registerDirectSend={agoraConnection.registerDirectRtmSend}
          urlParams={urlParams}
          getMessageChannelName={agoraConnection.getMessageChannelName}
        />

      </div>
    </div>
  );
}
    
export default App;