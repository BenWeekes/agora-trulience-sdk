import { useState, useCallback, useEffect } from 'react';
import AgoraRTC from "agora-rtc-sdk-ng";
import { ConnectionState } from "../utils/connectionState";
import { callNativeAppFunction } from '../utils/nativeBridge';
import logger from '../utils/logger';
import { setupAudioPassthrough } from '../utils/setupAudioPassthrough';

AgoraRTC.setLogLevel(3)

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

  const initializeAgoraClient = useCallback((
    agoraClientRef,
    trulienceAvatarRef
  ) => {
    if (agoraClientRef.current) {
      logger.warn("Agora client already initialized. Skipping.");
      return () => {};
    }
  
    logger.log("🚀 Initializing Agora client...");

    // Create Agora client
    agoraClientRef.current = AgoraRTC.createClient();
    // Set up event listeners
    agoraClientRef.current.on("user-published", async (user, mediaType) => {
      callNativeAppFunction("agoraUserPublished");
      
      logger.log("📴 User Published Stream received", { uid: user.uid, mediaType });
      
      if (user.uid && typeof user.uid === 'string' && user.uid.startsWith("agent")) {
        await agoraClientRef.current.subscribe(user, mediaType);

        logger.log("✅ Successfully subscribed to user", user.uid);
      } else {

        logger.warn("⚠️ No user UID, skipping subscription");
        return;
      }
  
      if (mediaType === "audio" && trulienceAvatarRef.current) {

        logger.log("🔊 Setting up audio stream for avatar");
        
        // The remote audio track is available.
        setupAudioPassthrough(agoraClientRef.current, user.audioTrack, "recv");  

        // Directly use the audio track with the avatar
        const stream = new MediaStream([user.audioTrack.getMediaStreamTrack()]);
        trulienceAvatarRef.current.setMediaStream(stream);
        

        logger.log("✅ Audio stream set for avatar");
      } else if (mediaType === "video" && trulienceAvatarRef.current) {

        logger.log("📹 Setting up video stream for avatar");
        

        
        // Directly use the video track with the avatar
        const avatarObj = trulienceAvatarRef.current?.getTrulienceObject();

        setTimeout(() => updateConnectionState(ConnectionState.AGORA_VIDEO_STREAM_READY), 1000)
        if (avatarObj) {
          avatarObj.initRTCVideoTrack(user.videoTrack);
  
          logger.log("✅ Video stream set for avatar");
        } else {
  
          logger.warn("⚠️ Avatar object not available for video stream");
        }
      }
    }); 
  
    // Handle user unpublished event
    agoraClientRef.current.on("user-unpublished", (user, mediaType) => {
      logger.log("📴 User unpublished", { uid: user.uid, mediaType });
      
      callNativeAppFunction("agoraUserUnpublished", { user, mediaType });
      if (mediaType === "audio"  && typeof user.uid === 'string' && user.uid.startsWith("agent") && trulienceAvatarRef.current) {
        // Clear the media stream
        trulienceAvatarRef.current.setMediaStream(null);

        logger.log("🔇 Cleared audio stream from avatar");
      }
    });
  
    agoraClientRef.current.on("user-joined", (user) => {
      logger.log("👋 User joined", user.uid);
      callNativeAppFunction("agoraUserJoined");
    });
  
    agoraClientRef.current.on("user-left", (user) => {
      logger.log("👋 User left", user.uid);
      callNativeAppFunction("agoraUserLeft");
    });

    logger.log("✅ Agora client initialized with event listeners");
  
    // Cleanup function
    return () => {
      logger.log("🧹 Cleaning up Agora client");
      if (agoraClientRef.current) {
        agoraClientRef.current.leave();
      }
    }
  }, []);

  // Initialize Agora client once
  useEffect(() => {
    logger.log("🔄 useEffect: Initializing Agora client...");
    
    const cleanupAgora = initializeAgoraClient(agoraClientRef, trulienceAvatarRef);
    return cleanupAgora;
  }, [initializeAgoraClient, agoraClientRef, trulienceAvatarRef]);

  const requestMicrophonePermission = useCallback(async () => {
    logger.log("🎤 Requesting microphone permission...");
    
    try {
      const audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
      logger.log("✅ Microphone permission granted");
      audioTrack.close()
      return true;
    } catch (error) {
      logger.error("❌ Microphone permission denied", error);
      showToast("Mic Access Needed", "Enable mic permission.", true);
      return false;
    }
  }, [showToast]);

  // Function to connect to Agora RTC
  const connectToAgoraRTC = useCallback(async (token, uid) => {
    logger.log("🔗 Connecting to Agora RTC", { uid, channel: derivedChannelName });
    
    updateConnectionState(ConnectionState.AGORA_CONNECTING);
    
    try {
      // Join the channel
      await agoraClientRef.current.join(
        agoraConfig.appId,
        derivedChannelName,
        token,
        uid
      );
      
      logger.log("✅ Successfully joined Agora channel");
      
      // Create and publish audio track in separate async function
      (async () => {
        try {
  
          logger.log("🎤 Creating microphone audio track...");
          
          // Create microphone track
          const audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
          setLocalAudioTrack(audioTrack);
          
  
          logger.log("📢 Publishing audio track...");
          
          // Publish the audio track
          await agoraClientRef.current.publish([audioTrack]);
          setupAudioPassthrough(agoraClientRef.current, audioTrack, "send");  
          setIsMuted(false);
          
  
          logger.log("✅ Audio track published successfully");
        } catch (error) {
  
          logger.error("❌ Error with audio track", error);
          setIsMuted(true);
        }
      })();
      
      updateConnectionState(ConnectionState.AGORA_CONNECTED);
      
      logger.log("🎉 Agora RTC connection completed successfully");
      
      return true;
    } catch (error) {
      logger.error("❌ Error connecting to Agora RTC", error);
      
      if (error.message && error.message.includes("Permission denied")) {

        logger.warn("⚠️ Permission denied - user already alerted");
      } else {
        showToast("Connection Error", error.message, true);
      }
      
      return false;
    }
  }, [agoraConfig.appId, derivedChannelName, updateConnectionState, showToast, agoraClientRef]);

  // Function to disconnect from Agora RTC
  const disconnectFromAgoraRTC = useCallback(async () => {
    logger.log("🔌 Disconnecting from Agora RTC...");
    
    if (localAudioTrack) {
      localAudioTrack.close();
      setLocalAudioTrack(null);
      logger.log("🔇 Local audio track closed");
    }
    
    if (agoraClientRef.current) {
      try {
        await agoraClientRef.current.leave();
        updateConnectionState(ConnectionState.AGORA_DISCONNECT);

        logger.log("✅ Successfully left Agora channel");
      } catch (error) {

        logger.error("❌ Error leaving Agora channel", error);
      }
    }
  }, [localAudioTrack, agoraClientRef, updateConnectionState]);

  // Function to toggle microphone mute/unmute
  const toggleMute = useCallback(() => {
    logger.log("🔇 Toggling mute state", { currentlyMuted: isMuted });
    
    if (localAudioTrack) {
      const newMuteState = !isMuted;
      localAudioTrack.setMuted(newMuteState);
      setIsMuted(newMuteState);
      
      logger.log("✅ Mute state changed", { muted: newMuteState });
    } else {
      logger.warn("⚠️ No local audio track available for mute toggle");
      showToast("Mic Access Needed", "Enable mic permission.", true);
    }
  }, [localAudioTrack, isMuted, showToast]);

  return {
    localAudioTrack,
    isMuted,
    connectToAgoraRTC,
    disconnectFromAgoraRTC,
    toggleMute,
    requestMicrophonePermission
  };
}