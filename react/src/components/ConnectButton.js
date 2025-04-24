import React from 'react';

/**
 * Component for the connect button displayed before joining a call
 */
export const ConnectButton = ({ onClick }) => {
  return (
    <div className="connect-overlay">
      <button className="connect-button" onClick={onClick}>
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
    </div>
  );
};
