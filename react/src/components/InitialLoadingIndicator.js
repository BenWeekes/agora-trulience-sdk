// components/InitialLoadingIndicator.js
import React from 'react';

/**
 * Component for displaying a loading indicator when the app first loads
 */
export const InitialLoadingIndicator = () => {
  return (
    <div className="initial-loading-container">
      <div className="initial-loading-content">
        <div className="initial-loading-spinner">
          <div className="spinner-circle"></div>
        </div>
        <div className="initial-loading-text">Loading...</div>
      </div>
    </div>
  );
};

// Don't forget to export the component in your components/index.js file
// export { InitialLoadingIndicator } from './InitialLoadingIndicator';