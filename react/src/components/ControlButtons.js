import React from 'react';
import { HangupButton, MicButton, SpeakerButton } from './IconButtons';

/**
 * Component for control buttons (mic on left, hangup on right)
 */
export const ControlButtons = ({
  isConnectInitiated,
  isMuted,
  isSpeakerMuted,
  toggleSpeaker,
  toggleMute,
  handleHangup
}) => {
  return (
    <div className={`control-buttons ${!isConnectInitiated ? "hidden" : ""}`}>
      {/* Left side controls - Mic button */}
      <div className="left-controls">
        <MicButton isMuted={isMuted} onClick={toggleMute} disabled={!isConnectInitiated} />
        <SpeakerButton isMuted={isSpeakerMuted} onClick={toggleSpeaker} disabled={!isConnectInitiated} />
      </div>
      
      {/* Right side controls - Hangup button */}
      <div className="right-controls">
        <HangupButton onClick={handleHangup} disabled={!isConnectInitiated} />
      </div>
    </div>
  );
};