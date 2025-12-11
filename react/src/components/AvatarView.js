// Updated AvatarView.js with integrated toast and purechat support
import React from "react";
import { TrulienceAvatar } from "@trulience/react-sdk"
import { Toast } from "./Toast";
import { FullscreenButton } from "./IconButtons";

/**
 * Component to display the Trulience Avatar with integrated toast notifications
 */
export const AvatarView = ({
  isAppConnected,
  isConnectInitiated,
  isAvatarLoaded,
  loadProgress,
  trulienceConfig,
  trulienceAvatarRef,
  eventCallbacks,
  children,
  isFullscreen,
  toggleFullscreen,
  toast, // Add toast prop here
  isPureChatMode = false,
}) => {
  return (
    <div className={`avatar-container ${isFullscreen ? "fullscreen" : ""}`}>
      {/* Fullscreen toggle button - hidden when not connected */}
      {isAppConnected && (
        <FullscreenButton isFullscreen={isFullscreen} onClick={toggleFullscreen} />
      )}

      {/* Trulience Avatar - hidden when not connected or in purechat mode without connection */}
      <div className={`trulience-avatar ${(!isAppConnected || (isPureChatMode && !isAppConnected)) ? "hidden" : ""}`}>
        <TrulienceAvatar
          key={trulienceConfig.avatarId}
          url={trulienceConfig.trulienceSDK}
          ref={trulienceAvatarRef}
          avatarId={trulienceConfig.avatarId}
          token={trulienceConfig.avatarToken}
          eventCallbacks={eventCallbacks}
          width="100%"
          height="100%"
          backgroundColor="transparent"
          autoConnect={false}
          envParams={{
            useAgoraVideo: true, // To get agora controller endpoint
          }}
        />
      </div>

      {/* Loading overlay - only show if connected but avatar not loaded */}
      {isConnectInitiated && !isAvatarLoaded && !isPureChatMode && (
        <div className="loading-overlay">
          <div className="progress-bar">
            <div
              className="progress-indicator"
              style={{ width: `${loadProgress * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Render children */}
      {children}
      <div id="floating-input"></div>
    </div>
  );
};