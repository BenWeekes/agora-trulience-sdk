import React from 'react';
import { TrulienceAvatar } from "trulience-sdk";

/**
 * Component to display the Trulience Avatar with loading indicator
 */
export const AvatarView = ({
  isConnected,
  isAvatarLoaded,
  loadProgress,
  trulienceConfig,
  trulienceAvatarRef,
  eventCallbacks,
  children
}) => {
  return (
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

      {/* Render children (control buttons) */}
      {children}
    </div>
  );
};
