// AndroidNativeHandler is a interface which contains all the functionality pass by Android code
export const AndroidNativeHandler = window.AndroidNativeHandler;

// IOSNativeHandler is a interface which contains all the functionality pass by IOS native
export const IOSNativeHandler = window.webkit?.messageHandlers;

/** This method calls the native android function if present */
const callNativeAndroidFunction = (func, message) => {
  // Return false if function is not present
  if (!AndroidNativeHandler?.[func]) return false;

  // Check if the message is an object and stringify it
  const stringifiedMessage =
    typeof message === "object" ? JSON.stringify(message) : message;

  try {
    // Call the corresponding function with the message parameter
    stringifiedMessage
      ? AndroidNativeHandler[func](stringifiedMessage)
      : AndroidNativeHandler[func]();
  } catch (err) {
    console.error("Error while calling android native function", err);
    return false;
  }

  return true;
};

/** This method calls the native iOS function if present */
const callNativeIOSFunction = (func, message) => {
  console.log(`Calling IOSNativeHandler.[${func}].`);
  if (!IOSNativeHandler?.[func]) {
    console.log(`IOSNativeHandler.[${func}] does not exist.`);
    return false;
  }

  try {
    // Check if the message is an object and stringify it
    const stringifiedMessage =
      typeof message === "object" ? JSON.stringify(message) : message;

    // Call the corresponding function with the message parameter
    IOSNativeHandler[func].postMessage(stringifiedMessage);
    console.log(`IOSNativeHandler.[${func}] posted.`);
  } catch (err) {
    console.error("Error while calling iOS native function", err);
    return false;
  }
  return true;
};

const fallbackHandler = () => {
  return false;
};

export const callNativeAppFunction = AndroidNativeHandler
  ? callNativeAndroidFunction
  : IOSNativeHandler
  ? callNativeIOSFunction
  : fallbackHandler;

export class NativeBridge {
  static INSTANCE = new NativeBridge();

  constructor() {
    this.eventListeners = {};
    return NativeBridge.INSTANCE;
  }

  static getInstance() {
    return NativeBridge.INSTANCE;
  }

  on(event, listener) {
    if (!this.eventListeners[event]) {
      this.eventListeners[event] = [];
    }
    this.eventListeners[event].push(listener);
  }

  off(event, listener) {
    if (!this.eventListeners[event]) return;

    this.eventListeners[event] = this.eventListeners[event].filter(
      (registeredListener) => registeredListener !== listener
    );
  }

  emit(event, data) {
    if (!this.eventListeners[event]) return;

    this.eventListeners[event].forEach((listener) => {
      listener(data);
    });
  }

  trulienceDetailsUpdated({ avatarId }) {
    this.emit("trulienceDetailsUpdated", {
      avatarId,
    });
  }

  agoraDetailsUpdated({ appId, channelName, uid, voiceId, prompt, greeting }) {
    this.emit("agoraDetailsUpdated", {
      appId,
      channelName,
      uid,
      voiceId: treatEmptyStringAsNull(voiceId),
      prompt: treatEmptyStringAsNull(prompt),
      greeting: treatEmptyStringAsNull(greeting),
    });
  }
}

const treatEmptyStringAsNull = (str) => (str === "" ? null : str);

window.NativeBridge = NativeBridge.getInstance();
