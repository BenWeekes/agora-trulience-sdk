import React, { useState, useRef, useEffect } from 'react';
import { sendRtmMessage } from '../utils/rtmUtils';
import { MessageEngine, MessageStatus } from '../utils/messageService';

/**
 * Component for RTM chat interface with live subtitles
 */
export const RtmChatPanel = ({
  rtmClient,
  rtmMessages,
  rtmJoined,
  agoraConfig,
  agoraClient // This is needed for the MessageEngine
}) => {
  const [rtmInputText, setRtmInputText] = useState("");
  const [liveSubtitles, setLiveSubtitles] = useState([]);
  const rtmMessageEndRef = useRef(null);
  const messageEngineRef = useRef(null);
  
  // Initialize MessageEngine for subtitles
  useEffect(() => {
    if (!agoraClient) return;
    
    // Create MessageEngine instance
    if (!messageEngineRef.current) {
      messageEngineRef.current = new MessageEngine(
        agoraClient,
        'auto',
        (messageList) => {
          // Update the subtitles when we receive updates from the MessageEngine
          if (messageList && messageList.length > 0) {
            setLiveSubtitles(messageList);
          }
        }
      );
    }
    
    // Cleanup on unmount
    return () => {
      if (messageEngineRef.current) {
        messageEngineRef.current.cleanup();
        messageEngineRef.current = null;
      }
    };
  }, [agoraClient]);
  
  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (rtmMessageEndRef.current) {
      rtmMessageEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [rtmMessages, liveSubtitles]);
  
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
  
  // Render a subtitle message
  const renderSubtitleMessage = (message, index) => {
    // Determine if it's a user message (from the microphone) or agent message
    const isUserMessage = message.uid !== 0; // Assuming agent uid is 0
    
    // Only show subtitles for messages that have text
    if (!message.text || message.text.trim().length === 0) return null;
    
    // Create classNames based on message status and sender
    let statusClassName = "";
    switch (message.status) {
      case MessageStatus.IN_PROGRESS:
        statusClassName = "subtitle-in-progress";
        break;
      case MessageStatus.END:
        statusClassName = "subtitle-complete";
        break;
      case MessageStatus.INTERRUPTED:
        statusClassName = "subtitle-interrupted";
        break;
      default:
        statusClassName = "";
    }
    
    return (
      <div
        key={`subtitle-${message.uid}-${message.turn_id}-${index}`}
        className={`rtm-message subtitle-message ${isUserMessage ? 'own-message' : 'other-message'} ${statusClassName}`}
      >
        <div className="rtm-message-sender">
          {isUserMessage ? 'You (Live)' : 'Agent (Live)'}
        </div>
        <div className="rtm-message-content">
          {message.text}
        </div>
        <div className="rtm-message-time">
          {new Date().toLocaleTimeString()}
        </div>
      </div>
    );
  };
  
  return (
    <div className="rtm-container">
      <div className="rtm-messages">
        {rtmMessages.length === 0 && liveSubtitles.length === 0 ? (
          <div className="rtm-empty-state">
            No messages yet. Start the conversation!
          </div>
        ) : (
          <>
            {/* Render live subtitles - only show IN_PROGRESS subtitles */}
            {liveSubtitles
              .filter(msg => msg.status === MessageStatus.IN_PROGRESS)
              .map((msg, index) => renderSubtitleMessage(msg, index))}
            
            {/* Render regular RTM messages */}
            {rtmMessages.map((msg, index) => (
              <div 
                key={`message-${index}`} 
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
            ))}
          </>
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