import React from 'react';

/**
 * Component for the connect button displayed within the avatar area
 */
export const ConnectButton = ({ onClick }) => {
  return (
    <button className="connect-button" onClick={onClick} title="Connect to avatar">
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
        <polygon points="5 3 19 12 5 21 5 3"></polygon>
      </svg>
    </button>
  );
};