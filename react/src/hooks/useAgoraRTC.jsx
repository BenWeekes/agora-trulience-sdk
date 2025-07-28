import { useState, useCallback, useEffect } from 'react';
import AgoraRTC from "agora-rtc-sdk-ng";
import { ConnectionState } from "../utils/connectionState";
import { callNativeAppFunction } from '../utils/nativeBridge';
import Logger from '../utils/logger';

// Store original console.log on first load (before it gets overridden)
if (!window.__originalConsoleLog) {
  window.__originalConsoleLog = console.log;
}

// Use the working console.log method
const log = window.__originalConsoleLog || console.log;

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
      log("⚠️ Agora client already initialized. Skipping.");
      Logger.warn("Agora client already initialized. Skipping.");
      return () => {};
    }
  
    log("🚀 Initializing Agora client...");
    Logger.log("🚀 Initializing Agora client...");
  
    // Create Agora client
    agoraClientRef.current = AgoraRTC.createClient();
  
    // Set up event listeners
    agoraClientRef.current.on("user-published", async (user, mediaType) => {
      callNativeAppFunction("agoraUserPublished");
      
      log("🎵 Media Stream: Audio track received", user);
      log("📊 Media Type:", mediaType);
      log("👤 User UID:", user.uid);
      Logger.log("🎵 Media Stream received", { uid: user.uid, mediaType });
      
      if (user.uid && typeof user.uid === 'string' && user.uid.startsWith("agent")) {
        await agoraClientRef.current.subscribe(user, mediaType);
        log("✅ Successfully subscribed to user:", user.uid);
        Logger.log("✅ Successfully subscribed to user", user.uid);
      } else {
        log("⚠️ No user UID, skipping subscription");
        Logger.warn("⚠️ No user UID, skipping subscription");
        return;
      }
  
      if (mediaType === "audio" && trulienceAvatarRef.current) {
        log("🔊 Setting up audio stream for avatar");
        Logger.log("🔊 Setting up audio stream for avatar");
        
        // Directly use the audio track with the avatar
        const stream = new MediaStream([user.audioTrack.getMediaStreamTrack()]);
        trulienceAvatarRef.current.setMediaStream(stream);
        
        log("✅ Audio stream set for avatar");
        Logger.log("✅ Audio stream set for avatar");
      } else if (mediaType === "video" && trulienceAvatarRef.current) {
        log("📹 Setting up video stream for avatar");
        Logger.log("📹 Setting up video stream for avatar");
        
        const stream = new MediaStream([user.videoTrack.getMediaStreamTrack()]);
        log("📹 Media Stream: Video track received", stream);
        Logger.log("📹 Video stream created", stream);
        
        // Directly use the video track with the avatar
        const avatarObj = trulienceAvatarRef.current?.getTrulienceObject();
        if (avatarObj) {
          avatarObj.setMediaStreamVideo(stream);
          log("✅ Video stream set for avatar");
          Logger.log("✅ Video stream set for avatar");
        } else {
          log("⚠️ Avatar object not available for video stream");
          Logger.warn("⚠️ Avatar object not available for video stream");
        }
      }
    }); 
  
    // Handle user unpublished event
    agoraClientRef.current.on("user-unpublished", (user, mediaType) => {
      log("📴 User unpublished:", user.uid, mediaType);
      Logger.log("📴 User unpublished", { uid: user.uid, mediaType });
      
      callNativeAppFunction("agoraUserUnpublished", { user, mediaType });
      if (mediaType === "audio"  && typeof user.uid === 'string' && user.uid.startsWith("agent") && trulienceAvatarRef.current) {
        // Clear the media stream
        trulienceAvatarRef.current.setMediaStream(null);
        log("🔇 Cleared audio stream from avatar");
        Logger.log("🔇 Cleared audio stream from avatar");
      }
    });
  
    agoraClientRef.current.on("user-joined", (user) => {
      log("👋 User joined:", user.uid);
      Logger.log("👋 User joined", user.uid);
      callNativeAppFunction("agoraUserJoined");
    });
  
    agoraClientRef.current.on("user-left", (user) => {
      log("👋 User left:", user.uid);
      Logger.log("👋 User left", user.uid);
      callNativeAppFunction("agoraUserLeft");
    });
  
    log("✅ Agora client initialized with event listeners");
    Logger.log("✅ Agora client initialized with event listeners");
  
    // Cleanup function
    return () => {
      log("🧹 Cleaning up Agora client");
      Logger.log("🧹 Cleaning up Agora client");
      if (agoraClientRef.current) {
        agoraClientRef.current.leave();
      }
    }
  }, []);

  // Initialize Agora client once
  useEffect(() => {
    log("🔄 useEffect: Initializing Agora client...");
    Logger.log("🔄 useEffect: Initializing Agora client...");
    
    const cleanupAgora = initializeAgoraClient(agoraClientRef, trulienceAvatarRef);
    return cleanupAgora;
  }, [initializeAgoraClient, agoraClientRef, trulienceAvatarRef]);

  const requestMicrophonePermission = useCallback(async () => {
    log("🎤 Requesting microphone permission...");
    Logger.log("🎤 Requesting microphone permission...");
    
    try {
      await AgoraRTC.createMicrophoneAudioTrack();
      log("✅ Microphone permission granted");
      Logger.log("✅ Microphone permission granted");
      return true;
    } catch (error) {
      log("❌ Microphone permission denied:", error);
      Logger.error("❌ Microphone permission denied", error);
      showToast("Mic Access Needed", "Enable mic permission.", true);
      return false;
    }
  }, [showToast]);

  // Function to connect to Agora RTC
  const connectToAgoraRTC = useCallback(async (token, uid) => {
    log("🔗 Connecting to Agora RTC...", { uid, channel: derivedChannelName });
    Logger.log("🔗 Connecting to Agora RTC", { uid, channel: derivedChannelName });
    
    updateConnectionState(ConnectionState.AGORA_CONNECTING);
    
    try {
      // Join the channel
      await agoraClientRef.current.join(
        agoraConfig.appId,
        derivedChannelName,
        token,
        uid
      );
      
      log("✅ Successfully joined Agora channel");
      Logger.log("✅ Successfully joined Agora channel");
      
      // Create and publish audio track in separate async function
      (async () => {
        try {
          log("🎤 Creating microphone audio track...");
          Logger.log("🎤 Creating microphone audio track...");
          
          // Create microphone track
          const audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
          setLocalAudioTrack(audioTrack);
          
          log("📢 Publishing audio track...");
          Logger.log("📢 Publishing audio track...");
          
          // Publish the audio track
          await agoraClientRef.current.publish([audioTrack]);
          setIsMuted(false);
          
          log("✅ Audio track published successfully");
          Logger.log("✅ Audio track published successfully");
        } catch (error) {
          log("❌ Error with audio track:", error);
          Logger.error("❌ Error with audio track", error);
          setIsMuted(true);
        }
      })();
      
      updateConnectionState(ConnectionState.AGORA_CONNECTED);
      
      log("🎉 Agora RTC connection completed successfully");
      Logger.log("🎉 Agora RTC connection completed successfully");
      
      return true;
    } catch (error) {
      log("❌ Error connecting to Agora RTC:", error);
      Logger.error("❌ Error connecting to Agora RTC", error);
      
      if (error.message && error.message.includes("Permission denied")) {
        log("⚠️ Permission denied - user already alerted");
        Logger.warn("⚠️ Permission denied - user already alerted");
      } else {
        showToast("Connection Error", error.message, true);
      }
      
      return false;
    }
  }, [agoraConfig.appId, derivedChannelName, updateConnectionState, showToast, agoraClientRef]);

  // Function to disconnect from Agora RTC
  const disconnectFromAgoraRTC = useCallback(async () => {
    log("🔌 Disconnecting from Agora RTC...");
    Logger.log("🔌 Disconnecting from Agora RTC...");
    
    if (localAudioTrack) {
      localAudioTrack.close();
      setLocalAudioTrack(null);
      log("🔇 Local audio track closed");
      Logger.log("🔇 Local audio track closed");
    }
    
    if (agoraClientRef.current) {
      try {
        await agoraClientRef.current.leave();
        updateConnectionState(ConnectionState.AGORA_DISCONNECT);
        log("✅ Successfully left Agora channel");
        Logger.log("✅ Successfully left Agora channel");
      } catch (error) {
        log("❌ Error leaving Agora channel:", error);
        Logger.error("❌ Error leaving Agora channel", error);
      }
    }
  }, [localAudioTrack, agoraClientRef, updateConnectionState]);

  // Function to toggle microphone mute/unmute
  const toggleMute = useCallback(() => {
    log("🔇 Toggling mute state, current:", isMuted);
    Logger.log("🔇 Toggling mute state", { currentlyMuted: isMuted });
    
    if (localAudioTrack) {
      const newMuteState = !isMuted;
      localAudioTrack.setMuted(newMuteState);
      setIsMuted(newMuteState);
      
      log("✅ Mute state changed to:", newMuteState);
      Logger.log("✅ Mute state changed", { muted: newMuteState });
    } else {
      log("⚠️ No local audio track available for mute toggle");
      Logger.warn("⚠️ No local audio track available for mute toggle");
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