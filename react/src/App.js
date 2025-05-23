import React, {
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState,
} from "react";
import "./App.css";
import { AvatarView } from "./components/AvatarView";
import { ConnectButton } from "./components/ConnectButton";
import ContentViewer from "./components/ContentView";
import { ControlButtons } from "./components/ControlButtons";
import { InitialLoadingIndicator } from "./components/InitialLoadingIndicator";
import { RtmChatPanel } from "./components/RtmChatPanel";
import { useToast } from "./components/Toast";
import { useAgoraConnection } from "./hooks/useAgoraConnection";
import { useAppConfig } from "./hooks/useAppConfig";
import { useContentManager } from "./hooks/useContentManager";
import useOrientationListener from "./hooks/useOrientationListener";
import useTrulienceAvatarManager from "./hooks/useTrulienceAvatarManager";
import { connectionReducer, ConnectionState, initialConnectionState, checkIfFullyConnected } from "./utils/connectionState";


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
    trulienceAvatarRef
  });

  
  // Manage content display state and related data
  const {
    isContentMode,
    contentData,
    toggleContentMode
  } = useContentManager(isConnectInitiated);


  // Simulate initial app loading
  useEffect(() => {
    const timer = setTimeout(() => {
      updateConnectionState(ConnectionState.APP_LOADED)
    }, 1500);
    return () => clearTimeout(timer);
  }, []);


  // Check for content in URL params when connection is established
  useEffect(() => {
    if (isAppConnected && urlParams.contentType && urlParams.contentURL) {
      console.log("Showing content from URL parameters on connect");
      toggleContentMode(true, {
        type: urlParams.contentType,
        url: urlParams.contentURL,
        alt: urlParams.contentALT || "Content",
        autoPlay: true
      });
    }
  }, [isAppConnected, urlParams, toggleContentMode]);
    

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


  // Connect Function
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

  
  // Handle hangup
  const handleHangup = async () => {
    toggleContentMode(false)
  
    // Send commands to reset the avatar
    resetAvatarToDefault()

    // Disconnect from all Agora services
    await agoraConnection.disconnectFromAgora();

    updateConnectionState(ConnectionState.DISCONNECT);

    // Exit fullscreen mode if active
    if (isFullscreen) {
      setIsFullscreen(false);
      setIsRtmVisible(true);
    }
    
  };

  // Show initial loading screen if the app is still loading
  if (connectionState.app.loading) {
    return <InitialLoadingIndicator />;
  }

  const isMobileView = orientation === "portrait"

  return (
    <div
      className={`app-container ${!isConnectInitiated ? "initial-screen" : ""} ${
        isRtmVisible && !isFullscreen ? "rtm-visible" : ""
      } ${orientation} ${isContentMode ? "content-mode" : ""}`}
    >
      {/* Content wrapper - always in split view unless fullscreen */}
      <div className={`content-wrapper ${!isFullscreen ? "split-view" : ""} ${orientation}`}>

        <div className={`left-section ${isContentMode ? "content-view-active" : ""}`}>

          {/* Content container - shown when content mode is active */}
          {isContentMode && (
            <ContentViewer 
              contentData={contentData}
              toggleContentMode={toggleContentMode}
            />
          )}

          {/* Avatar container wrapper */}
          <div className={`avatar-container-wrapper ${isContentMode && isMobileView ? "floating" : ""}`}>
            <AvatarView
              isConnectInitiated={isConnectInitiated}
              isAvatarLoaded={connectionState.avatar.loaded}
              loadProgress={loadProgress}
              trulienceConfig={trulienceConfig}
              trulienceAvatarRef={trulienceAvatarRef}
              eventCallbacks={avatarEventHandlers}
              isFullscreen={isFullscreen}
              toggleFullscreen={toggleFullscreen}
              toast={toast.visible ? toast : null}
            >
              {/* Direct connect button rendering when not connected */}
              {!isConnectInitiated ? (
                <ConnectButton onClick={connectAgoraTrulience} />
              ) : (
                <ControlButtons
                  isConnectInitiated={isConnectInitiated}
                  isMuted={agoraConnection.isMuted}
                  toggleMute={agoraConnection.toggleMute}
                  handleHangup={handleHangup}
                />
              )}

              {isConnectInitiated && connectionState.avatar.loaded && !isAppConnected && (
                <div className="spinner-container">
                  <div className="spinner" />
                </div>
              )}
            </AvatarView>
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
        />
      </div>
    </div>
  );
}
    
export default App;