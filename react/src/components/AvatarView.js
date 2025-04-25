import React from "react";
import { TrulienceAvatar } from "trulience-sdk";

/**
 * Component to display the Trulience Avatar with loading indicator
 * Updated to have profile picture and connect button stacked vertically
 */
export const AvatarView = ({
  isConnected,
  isAvatarLoaded,
  loadProgress,
  trulienceConfig,
  trulienceAvatarRef,
  eventCallbacks,
  children,
  isFullscreen,
  toggleFullscreen
}) => {
  return (
    <div className={`avatar-container ${isFullscreen ? "fullscreen" : ""}`}>
      {/* Fullscreen toggle button - hidden when not connected */}
      {isConnected && (
        <button 
          className={`fullscreen-button ${!isConnected ? "hidden" : ""}`}
          onClick={toggleFullscreen}
          title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
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
            {isFullscreen ? (
              // Minimize icon
              <>
                <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
              </>
            ) : (
              // Maximize icon
              <>
                <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
              </>
            )}
          </svg>
        </button>
      )}

      {/* Trulience Avatar - hidden when not connected */}
      <div className={`trulience-avatar ${!isConnected ? "hidden" : ""}`}>
        <TrulienceAvatar
          key={trulienceConfig.avatarId}
          url={trulienceConfig.trulienceSDK}
          ref={trulienceAvatarRef}
          avatarId={trulienceConfig.avatarId}
          token={trulienceConfig.avatarToken}
          eventCallbacks={eventCallbacks}
          width="100%"
          height="100%"
        />
      </div>

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

      {/* Render children (control buttons and connect button) */}
      {children}
    </div>
  );
};