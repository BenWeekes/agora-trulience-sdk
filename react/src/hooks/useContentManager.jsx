import { useState, useEffect, useCallback } from "react";

export const useContentManager = (isConnected) => {
  const [isContentMode, setIsContentMode] = useState(false);
  const [contentData, setContentData] = useState(null);


  const toggleContentMode = useCallback((showContent = true, data = null) => {
    setIsContentMode(showContent);
    if (data) {
      setContentData(data);
    } else if (!showContent) {
      setContentData(null);
    }
  }, []);


  const showContent = useCallback((type, url, alt, autoPlay = true) => {
    if (isConnected) {
      toggleContentMode(true, {
        type,
        url,
        alt: alt || "Content",
        autoPlay,
      });
      return true;
    }
    console.warn("Cannot show content - not connected to agent");
    return false;
  }, [isConnected, toggleContentMode]);


  // Play the video manually if needed
  const playVideo = useCallback(() => {
    const videoEl = document.querySelector(".content-video");
    setContentData(prev => ({ ...prev, autoPlay: true }))
    if (videoEl) {
      videoEl.play().catch((err) => console.warn("Video play failed", err));
    }
  }, []);


  // Expose showContent & playVideo globally
  useEffect(() => {
    window.trulienceApp = {
      showContent,
      playVideo,
    };
    return () => {
      delete window.trulienceApp;
    };
  }, [showContent, playVideo]);

  
  return {
    isContentMode,
    contentData,
    toggleContentMode,
    showContent,
    playVideo,
  };
};
