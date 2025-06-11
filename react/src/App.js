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
import { InitialLoadingIndicator } from "./components/InitialLoadingIndicator";
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

  console.log("Connection state:", {
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

  
  // Manage Trulience avatar lifecycle and messaging
  const {
    avatarEventHandlers,
    processAndSendMessageToAvatar,
    resetAvatarToDefault,
    trulienceAvatarRef
  } = useTrulienceAvatarManager({
    showToast,
    setLoadProgress,
    updateConnectionState,
    eventHandler: {
      "avatar-status-update": (data) => {
        agoraConnection.handleContinueParamOnAvatarStatus(data)
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
    isFullyConnected: isAppConnected
  });

  
  // Manage content display state and related data
  const contentManager = useContentManager(isConnectInitiated);


  // Simulate initial app loading
  useEffect(() => {
    const timer = setTimeout(() => {
      updateConnectionState(ConnectionState.APP_LOADED)
    }, 1500);
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
      console.log("Auto-connecting purechat mode (silent) - RTM only, no UI change");
      pureChatConnectionAttempted.current = true;
      
      agoraConnection.connectToPureChat().catch((error) => {
        console.error("Purechat connection failed:", error);
        // Reset the flag on failure so it can be retried later
        pureChatConnectionAttempted.current = false;
      });
    }

    // Reset the flag when not in purechat mode or when disconnected
    if (!isPureChatMode || !connectionState.app.loaded) {
      pureChatConnectionAttempted.current = false;
    }
  }, [connectionState.app.loaded, isPureChatMode, isConnectInitiated, agoraConnection]);


  // Check for content in URL params when connection is established
  useEffect(() => {
    if (isAppConnected && urlParams.contentType && urlParams.contentURL) {
      console.log("Showing content from URL parameters on connect");
      contentManager.toggleContentMode(true, {
        type: urlParams.contentType,
        url: urlParams.contentURL,
        alt: urlParams.contentALT || "Content",
        autoPlay: true
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAppConnected, urlParams, contentManager.toggleContentMode]);
    

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
    
    // We connect avatar on load, so no need to connect trulience avatar explicitly
    // updateConnectionState(ConnectionState.AVATAR_WS_CONNECTING);
    
    // connect Agora
    const result = await agoraConnection.connectToAgora()
    
    if(!result) {
      handleHangup()
    }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agoraConnection]);

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
    
    contentManager.toggleContentMode(false)

    // Send commands to reset the avatar (only in normal mode)
    if (!isPureChatMode) {
      resetAvatarToDefault()
    }

    // Disconnect from all Agora services
    await agoraConnection.disconnectFromAgora();

    updateConnectionState(ConnectionState.DISCONNECT);

    // Exit fullscreen mode if active
    if (isFullscreen) {
      setIsFullscreen(false);
      setIsRtmVisible(true);
    }
    
  };

  const layoutState = useLayoutState(contentManager, urlParams, orientation);
  const { isMobileView, isContentLayoutWide, isContentLayoutDefault, isAvatarOverlay, isContentLayoutWideOverlay } = layoutState;

  // Show initial loading screen if the app is still loading
  if (connectionState.app.loading) {
    return <InitialLoadingIndicator />;
  }

  /* Console debug info instead of UI display */
  if(process.env.NODE_ENV === "development") {
    console.log("Debug Info:", {
      purechat: isPureChatMode,
      connected: isConnectInitiated,
      agoraClient: !!agoraClient.current,
      rtmClient: !!agoraConnection.rtmClient,
      skin: skinType,
    });
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
        <div style={{ minHeight: "50vh", position: "relative" }}>
          <ContentViewer
            contentData={contentManager.contentData}
            toggleContentMode={contentManager.toggleContentMode}
            style={{ height: "100%", width: "100vw" }}
          />
        </div>
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
          className={`left-section`}
          style={leftSectionStyle}
        >
          {!isAppConnected && (
            <ConnectScreen
              avatarId={trulienceConfig.avatarId}
              isPureChatMode={isPureChatMode}
              connectionState={connectionState}
              onConnect={connectAgoraTrulience}
              onHangUp={handleHangup}
            />
          )}

          {/* Toast notification - placed inside avatar container */}
          <Toast {...toast} />

          <div style={avatarWrapperStyle} >
            {/* Content container - shown when content mode is active */}
            {isContentLayoutDefault && (
              <ContentViewer
                contentData={contentManager.contentData}
                toggleContentMode={contentManager.toggleContentMode}
                style={{
                  height: isAvatarOverlay && "100%",
                }}
              />
            )}

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
                    : undefined,
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
                    handleHangup={handleHangup}
                  />
                )}
              </AvatarView>
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