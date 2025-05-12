import { useCallback, useMemo, useRef } from "react";
import { processMessageCommands } from "../utils/trulienceUtils";
import { callNativeAppFunction } from "../utils/nativeBridge";
import { ConnectionState } from "../utils/connectionState";

export default function useTrulienceAvatarManager({
  showToast,
  setLoadProgress,
  updateConnectionState,
  eventHandler = {}
}) {
  const trulienceAvatarRef = useRef(null);

  const eventHandlerRef = useRef();
  eventHandlerRef.current = eventHandler;

  // Trulience Event Handler
  const avatarEventHandlers = useMemo(() => {
    const eventHandler = eventHandlerRef.current
    return ({
    ...eventHandler,
    "auth-success": (data) => {
      console.log("Auth success:", data);
      eventHandler["auth-success"]?.(data)
      callNativeAppFunction("trlAuthSuccess", data);
    },
    "auth-fail": (data) => {
      showToast("Authentication Failed", data.message, true);
      eventHandler["auth-fail"]?.(data)
      callNativeAppFunction("trlAuthFail", data);
    },
    "websocket-connect": (data) => {
      console.log("WebSocket connected:", data);
      eventHandler["websocket-connect"]?.(data)
      callNativeAppFunction("trlWebsocketConnect", data);
      updateConnectionState(ConnectionState.AVATAR_WS_CONNECTED);
    },
    "websocket-close": (data) => {
      eventHandler["websocket-close"]?.(data)
      callNativeAppFunction("trlWebsocketClose", data);
    },
    "websocket-message": (msg) => {
      eventHandler["websocket-message"]?.(msg)
      callNativeAppFunction("trlWebsocketMessage", msg);
    },
    "load-progress": ({ progress, ...details }) => {
      eventHandler["load-progress"]?.({ progress, ...details })
      setLoadProgress(progress);
      if (progress >= 1) {
        updateConnectionState(ConnectionState.AVATAR_LOADED);
      }
      callNativeAppFunction("trlLoadProgress", { progress, ...details });
    },
    "mic-update": (data) => {
      eventHandler["mic-update"]?.(data)
      callNativeAppFunction("trlMicUpdate",data)
    },
    "mic-access": (data) => {
      eventHandler["mic-access"]?.(data)
      callNativeAppFunction("trlMicAccess", data)
    },
    "speaker-update": (data) => {
      eventHandler["speaker-update"]?.(data)
      callNativeAppFunction("trlSpeakerUpdate", data)
    },
    "trl-chat": (data) => {
      eventHandler["trl-chat"]?.(data)
      callNativeAppFunction("trlChat", data)
    },
    "avatar-status-update": (data) => {
      eventHandler["avatar-status-update"]?.(data)
    }
  })
}, [showToast, setLoadProgress, updateConnectionState]);


  // Function to send message to Trulience avatar
  const sendMessageToAvatar = useCallback((message) => {
    if (trulienceAvatarRef.current) {
      const trulienceObj = trulienceAvatarRef.current.getTrulienceObject();
      if (trulienceObj) {
        console.log("Sending message to Trulience avatar:", message);
        trulienceObj.sendMessageToAvatar(message);
        return true;
      } else {
        console.warn("Trulience object not available yet");
      }
    } else {
      console.warn("Trulience avatar ref not available");
    }
    return false;
  }, []);


  // Process message and handle any commands
  const processAndSendMessageToAvatar = useCallback((message, contextId = "") => {
    return processMessageCommands(message, sendMessageToAvatar, contextId);
  }, [sendMessageToAvatar]);


  const resetAvatarToDefault = useCallback(() => {
    const avatarObj = trulienceAvatarRef.current?.getTrulienceObject();
    if (avatarObj) {
      avatarObj.sendMessageToAvatar("<trl-stop-background-audio immediate='true' />");
      avatarObj.sendMessageToAvatar("<trl-content position='DefaultCenter' />");
      console.log("Avatar reset triggered");
    }
  }, []);


  return {
    trulienceAvatarRef,
    avatarEventHandlers,
    sendMessageToAvatar,
    processAndSendMessageToAvatar,
    resetAvatarToDefault
  }
}