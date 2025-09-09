import React from 'react';
import ReactDOM from 'react-dom/client';
import "./utils/encodedInsertableStreams"
import './index.css';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Register service worker for production environment
// if ("serviceWorker" in navigator) {
//   if (process.env.REACT_APP_ENV === "production") {
//     window.addEventListener("load", () => {
//       navigator.serviceWorker
//         .register("/sw.js")
//         .then((registration) => {
//           console.log("Service Worker registered:", registration);
//         })
//         .catch((error) => {
//           console.log("Service Worker registration failed:", error);
//         });
//     });
//   } else {
//     console.log("Service Worker not registered in non-production environment");
//   }
// }