/**
 * Call a function in the native app if the app is embedded in a WebView
 * 
 * @param {string} functionName - Name of function to call
 * @param {object} data - Optional data to pass to the function
 */
export const callNativeAppFunction = (functionName, data = {}) => {
  try {
    // Check if running in iOS WebView (window.webkit exists)
    if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.reactNativeWebView) {
      window.webkit.messageHandlers.reactNativeWebView.postMessage({
        functionName,
        data: JSON.stringify(data),
      });
      return;
    }

    // Check if running in Android WebView (window.ReactNativeWebView exists)
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(
        JSON.stringify({
          functionName,
          data,
        })
      );
      return;
    }

    // Not running in a WebView, log instead
    console.log(`Would call native app function: ${functionName}`, data);
  } catch (error) {
    console.error(`Error calling native app function: ${functionName}`, error);
  }
};

/**
 * Native Bridge class for communication with mobile app WebView
 */
export class NativeBridge {
  constructor() {
    this.eventListeners = {};
    this.setupMessageListener();
  }

  /**
   * Set up event listener for messages from native app
   */
  setupMessageListener() {
    window.addEventListener('message', (event) => {
      try {
        const message = typeof event.data === 'string' 
          ? JSON.parse(event.data) 
          : event.data;
        
        if (message && message.type && this.eventListeners[message.type]) {
          this.eventListeners[message.type].forEach(callback => {
            callback(message.data);
          });
        }
      } catch (error) {
        console.error('Error processing message from native app', error);
      }
    });
  }

  /**
   * Subscribe to an event
   * 
   * @param {string} eventName - Name of event to listen for
   * @param {Function} callback - Callback to execute when event occurs
   */
  on(eventName, callback) {
    if (!this.eventListeners[eventName]) {
      this.eventListeners[eventName] = [];
    }
    this.eventListeners[eventName].push(callback);
  }

  /**
   * Unsubscribe from an event
   * 
   * @param {string} eventName - Name of event to unsubscribe from
   * @param {Function} callback - Callback to remove
   */
  off(eventName, callback) {
    if (this.eventListeners[eventName]) {
      this.eventListeners[eventName] = this.eventListeners[eventName]
        .filter(cb => cb !== callback);
    }
  }

  /**
   * Emit an event to native app
   * 
   * @param {string} eventName - Name of event to emit
   * @param {*} data - Data to pass with the event
   */
  emit(eventName, data) {
    callNativeAppFunction('handleEvent', { type: eventName, data });
  }
}
