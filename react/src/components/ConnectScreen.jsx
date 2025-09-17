import { useEffect, useRef } from "react";
import { ConnectButton, DisconnectButton } from "./ConnectButton";
import { checkIfFullyConnected } from "../utils/connectionState";
import logger from "../utils/logger";

const ConnectScreen = ({
  avatarId,
  onConnect,
  onHangUp,
  isPureChatMode,
  connectionState,
  ringtone = true
}) => {
  const audioRef = useRef(null);
  const ringToneUrl = "/ring-tone.mp3";

  const isConnected = checkIfFullyConnected(connectionState);
  const isRinging = connectionState.app.connectInitiated && !isConnected;

  const playRingTone = () => {
    if (audioRef.current) {
      audioRef.current.volume = 0.1;
      audioRef.current.currentTime = 0; // Reset to beginning
      audioRef.current.play().catch((error) => {
        logger.error("Audio play failed:", error);
      });
    }
  };

  useEffect(() => {
    if (!ringtone) return

    let ringInterval;
    const audioElement = audioRef.current;

    // play ringing till the agora rtm connected, to avoid AEC issue.
    if (isRinging && !connectionState.rtm.connected) {
      playRingTone();
    }

    return () => {
      if (ringInterval) {
        clearInterval(ringInterval);
      }
      // Stop audio when component unmounts or ringing stops
      if (audioElement) {
        audioElement.pause();
        audioElement.currentTime = 0;
      }
    };
  }, [isRinging, connectionState.rtm.connected, ringtone]);

  return (
    <div className="connect-button-container">
      <div className="profile-container">
        {isRinging && (
          <>
            <div className="pulse-ring-1"></div>
            {/* <div className="pulse-ring-2"></div> */}
            <div className="profile-overlay">Calling...</div>
          </>
        )}

        <img
          src={`${process.env.REACT_APP_TRULIENCE_PROFILE_BASE}/${avatarId}/profile.jpg`}
          alt="Avatar Profile"
          className="avatar-profile-image"
          onError={(e) => {
            // Fallback if the image fails to load
            e.target.src =
              "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='1' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='12' cy='8' r='5'/%3E%3Cpath d='M20 21a8 8 0 0 0-16 0'/%3E%3C/svg%3E";
            e.target.style.backgroundColor = "#444";
          }}
        />
      </div>

      {isRinging ? (
        <DisconnectButton onClick={onHangUp} />
      ) : (
        <ConnectButton
          onClick={onConnect}
          isPureChatMode={isPureChatMode}
          disabled={!connectionState.app.readyToConnect}
        />
      )}

      {/* Hidden audio element for ring tone */}
      <audio ref={audioRef} preload="auto" loop={true}>
        <source src={ringToneUrl} type="audio/mpeg" />
        Your browser does not support the audio element.
      </audio>
    </div>
  );
};

export default ConnectScreen;
