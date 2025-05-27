import React from 'react';

/**
 * Component for the connect button displaying a WhatsApp-style video call icon
 */
export const ConnectButton = ({ onClick, isPureChatMode = false }) => {
  // Log when button is clicked to verify handler is working
  const handleClick = () => {
    console.log('Connect button clicked', isPureChatMode ? '(purechat mode)' : '(normal mode)');
    if (onClick && typeof onClick === 'function') {
      onClick();
    }
  };

  const getButtonText = () => {
    return isPureChatMode ? "Connect to Avatar" : "Video Call";
  };

  return (
    <button 
      className="connect-button video-call"
      onClick={handleClick} 
      title={getButtonText()}
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
        <path d="M23 7l-7 5 7 5V7z"></path>
        <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
      </svg>
    </button>
  );
};