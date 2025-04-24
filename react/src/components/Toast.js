import React from 'react';

/**
 * Component for toast notifications
 */
export const Toast = ({ title, details, isError }) => {
  return (
    <div
      className={`toast-notification ${
        isError ? "toast-error" : "toast-success"
      }`}
    >
      <div className="toast-title">{title}</div>
      {details && (
        <div className="toast-details">{details}</div>
      )}
    </div>
  );
};
