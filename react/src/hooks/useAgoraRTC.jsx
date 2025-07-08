import { useState, useCallback, useEffect } from 'react';
import AgoraRTC from "agora-rtc-sdk-ng";
import { ConnectionState } from "../utils/connectionState";
import { callNativeAppFunction } from '../utils/nativeBridge';

/**
 * Custom hook for managing Agora RTC functionality
 */
export function useAgoraRTC({
  agoraConfig,
  derivedChannelName,
  updateConnectionState,
  showToast,
  agoraClientRef,
  trulienceAvatarRef
}) {
  const [localAudioTrack, setLocalAudioTrack] = useState(null);
  const [isMuted, setIsMuted] = useState(false);

  const initializeAgoraClient = (
    agoraClientRef,
    trulienceAvatarRef
  ) => {
    if (agoraClientRef.current) {
      console.warn("Agora client already initialized. Skipping.");
      return () => {};
    }
  
    // Create Agora client
    agoraClientRef.current = AgoraRTC.createClient();
  
    // Set up event listeners
    agoraClientRef.current.on("user-published", async (user, mediaType) => {
      callNativeAppFunction("agoraUserPublished");
  
      if (user.uid) {
        await agoraClientRef.current.subscribe(user, mediaType);
      } else {
        return;
      }
  
      if (mediaType === "audio" && trulienceAvatarRef.current) {
        console.log("Media Stream: Audio track received");
        // Directly use the audio track with the avatar
        const stream = new MediaStream([user.audioTrack.getMediaStreamTrack()]);
        trulienceAvatarRef.current.setMediaStream(stream);
      } if ( mediaType === "video" && trulienceAvatarRef.current ) {
        const stream = new MediaStream([user.videoTrack.getMediaStreamTrack()]);
        console.log("Media Stream: Video track received", stream);
        // Directly use the audio track with the avatar
        const avatarObj = trulienceAvatarRef.current?.getTrulienceObject();
        if (avatarObj) {
          avatarObj.setMediaStreamVideo(stream);
        }
      }
    }); 
  
    // Handle user unpublished event
    agoraClientRef.current.on("user-unpublished", (user, mediaType) => {
      callNativeAppFunction("agoraUserUnpublished", { user, mediaType });
      if (mediaType === "audio" && trulienceAvatarRef.current) {
        // Clear the media stream
        trulienceAvatarRef.current.setMediaStream(null);
      }
    });
  
    agoraClientRef.current.on("user-joined", () => {
      callNativeAppFunction("agoraUserJoined");
    });
  
    agoraClientRef.current.on("user-left", () => {
      callNativeAppFunction("agoraUserLeft");
    });
  
    // Cleanup function
    return () => {
      if (agoraClientRef.current) {
        agoraClientRef.current.leave();
      }
    }
  };

  // Initialize Agora client once
  useEffect(() => {
    const cleanupAgora = initializeAgoraClient(agoraClientRef, trulienceAvatarRef);
    return cleanupAgora;
  }, []);

  const requestMicrophonePermission = async () => {
    try {
      await AgoraRTC.createMicrophoneAudioTrack();
    } catch (error) {
      // showToast("Microphone Access Denied", null, true)
      showToast("Mic Access Needed", "Enable mic permission.", true);
      return false
    }
    return true
  }

  // Function to connect to Agora RTC
  const connectToAgoraRTC = useCallback(async (token, uid) => {
    updateConnectionState(ConnectionState.AGORA_CONNECTING);
    
    try {
      
      // Join the channel
      await agoraClientRef.current.join(
        agoraConfig.appId,
        derivedChannelName,
        token,
        uid
      );
      
      (async () => {
        try {
          // Create microphone track
          const audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
          setLocalAudioTrack(audioTrack);
          
          // Publish the audio track
          await agoraClientRef.current.publish([audioTrack]);
          setIsMuted(false)
        } catch (error) {
          setIsMuted(true)
        }
      })()
      
      updateConnectionState(ConnectionState.AGORA_CONNECTED);
      
      return true;
    } catch (error) {
      console.error("Error connecting to Agora RTC:", error);
      
      if (error.message && error.message.includes("Permission denied")) {
        // we have already alert the user
      } else {
        showToast("Connection Error", error.message, true);
      }
      
      return false;
    }
  }, [agoraConfig.appId, derivedChannelName, updateConnectionState, showToast, agoraClientRef]);

  // Function to disconnect from Agora RTC
  const disconnectFromAgoraRTC = useCallback(async () => {
    if (localAudioTrack) {
      localAudioTrack.close();
      setLocalAudioTrack(null);
    }
    
    if (agoraClientRef.current) {
      try {
        await agoraClientRef.current.leave();
        updateConnectionState(ConnectionState.AGORA_DISCONNECT)
      } catch (error) {
        console.error("Error leaving Agora channel:", error);
      }
    }
  }, [localAudioTrack, agoraClientRef, updateConnectionState]);

  // Function to toggle microphone mute/unmute
  const toggleMute = useCallback(() => {
    if (localAudioTrack) {
      const newMuteState = !isMuted;
      localAudioTrack.setMuted(newMuteState);
      setIsMuted(newMuteState);
    } else {
      showToast("Mic Access Needed", "Enable mic permission.", true);
    }
  }, [localAudioTrack, isMuted]);

  return {
    localAudioTrack,
    isMuted,
    connectToAgoraRTC,
    disconnectFromAgoraRTC,
    toggleMute,
    requestMicrophonePermission
  };
}