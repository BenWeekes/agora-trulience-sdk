import React, { useState, useRef, useEffect } from 'react';
import { sendRtmMessage } from '../utils/rtmUtils';

/**
 * Component for RTM chat interface
 */
export const RtmChatPanel = ({
  rtmClient,
  rtmMessages,
  rtmJoined,
  agoraConfig
}) => {
  const [rtmInputText, setRtmInputText] = useState("");
  const rtmMessageEndRef = useRef(null);
  
  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (rtmMessageEndRef.current) {
      rtmMessageEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [rtmMessages]);
  
  // Handle RTM input change
  const handleRtmInputChange = (e) => {
    setRtmInputText(e.target.value);
  };
  
  // Handle RTM input keypress
  const handleRtmInputKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };
  
  // Send RTM message to the agent
  const handleSendMessage = async () => {
    if (!rtmInputText.trim() || !rtmJoined) return;
    
    const success = await sendRtmMessage(
      rtmClient,
      rtmInputText,
      agoraConfig.uid
    );
    
    if (success) {
      // Add the sent message to the local state immediately
      // This provides instant feedback to the user
      const sentMessage = {
        type: 'user',
        time: Date.now(),
        content: rtmInputText.trim(),
        contentType: 'text',
        userId: String(agoraConfig.uid),
        isOwn: true
      };
      
      // Update the message list with the sent message
      rtmMessages.push(sentMessage);
      
      // Clear input after sending
      setRtmInputText("");
    }
  };
  
  return (
    <div className="rtm-container">
      <div className="rtm-messages">
        {rtmMessages.length === 0 ? (
          <div className="rtm-empty-state">
            No messages yet. Start the conversation!
          </div>
        ) : (
          rtmMessages.map((msg, index) => (
            <div 
              key={index} 
              className={`rtm-message ${msg.isOwn ? 'own-message' : 'other-message'}`}
            >
              <div className="rtm-message-sender">
                {msg.isOwn ? 'You' : `Agent`}
              </div>
              <div className="rtm-message-content">
                {msg.contentType === 'image' ? (
                  <img 
                    src={msg.content} 
                    alt="Shared image" 
                    className="rtm-image-content" 
                  />
                ) : (
                  msg.content
                )}
              </div>
              <div className="rtm-message-time">
                {new Date(msg.time).toLocaleTimeString()}
              </div>
            </div>
          ))
        )}
        <div ref={rtmMessageEndRef} />
      </div>
      <div className="rtm-input-container">
        <textarea
          className="rtm-input"
          value={rtmInputText}
          onChange={handleRtmInputChange}
          onKeyPress={handleRtmInputKeyPress}
          placeholder="Type a message..."
          disabled={!rtmJoined}
        />
        <button 
          className="rtm-send-button" 
          onClick={handleSendMessage}
          disabled={!rtmJoined || !rtmInputText.trim()}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            width="24"
            height="24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
          </svg>
        </button>
      </div>
    </div>
  );
};