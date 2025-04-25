import React, { useState, useRef, useEffect } from 'react';
import { sendRtmMessage } from '../utils/rtmUtils';
import { MessageEngine, MessageStatus } from '../utils/messageService';

/**
 * Component for RTM chat interface with integrated live subtitles and typed messages
 */
export const RtmChatPanel = ({
  rtmClient,
  rtmMessages,
  rtmJoined,
  agoraConfig,
  agoraClient, // This is needed for the MessageEngine
  isConnected // New prop to check connection status
}) => {
  const [rtmInputText, setRtmInputText] = useState("");
  const [liveSubtitles, setLiveSubtitles] = useState([]);
  const [combinedMessages, setCombinedMessages] = useState([]);
  const rtmMessageEndRef = useRef(null);
  const messageEngineRef = useRef(null);
  
  // Initialize MessageEngine for subtitles
  useEffect(() => {
    if (!agoraClient) return;
    
    console.log("Initializing MessageEngine with client:", agoraClient);

    // Create MessageEngine instance
    if (!messageEngineRef.current) {
      messageEngineRef.current = new MessageEngine(
        agoraClient,
        'auto',
        (messageList) => {
          console.debug(`Received ${messageList.length} subtitle messages`);

          // Update the subtitles when we receive updates from the MessageEngine
          if (messageList && messageList.length > 0) {
            setLiveSubtitles(messageList);
          }
        }
      );
      console.log("MessageEngine initialized:", messageEngineRef.current);
    }
    
    // Cleanup on unmount
    return () => {
      if (messageEngineRef.current) {
        messageEngineRef.current.cleanup();
        messageEngineRef.current = null;
      }
    };
  }, [agoraClient]);
  
  // Combine live subtitles and RTM messages into a single timeline
  useEffect(() => {
    // Process live subtitles
    const subtitleMessages = [];
    
    // Add completed messages
    liveSubtitles
      .filter(msg => msg.status !== MessageStatus.IN_PROGRESS)
      .forEach(msg => {
        // Get text either from text property or metadata
        const messageText = msg.text || (msg.metadata && msg.metadata.text) || '';
        
        if (messageText && messageText.trim().length > 0) {
          subtitleMessages.push({
            id: `subtitle-${msg.uid}-${msg.turn_id}`,
            type: msg.uid === 0 ? 'agent' : 'user',
            time: msg._time || Date.now(),
            content: messageText,
            contentType: 'text',
            userId: String(msg.uid),
            isOwn: msg.uid !== 0, // User messages are "own" messages
            isSubtitle: true,
            status: msg.status
          });
        }
      });
    
    // Add in-progress messages (only the latest from each speaker)
    const inProgressMessages = [];
    liveSubtitles
      .filter(msg => msg.status === MessageStatus.IN_PROGRESS)
      .forEach(msg => {
        // Get text either from text property or metadata
        const messageText = msg.text || (msg.metadata && msg.metadata.text) || '';
        
        if (messageText && messageText.trim().length > 0) {
          // Check if we already added an in-progress message from this speaker
          const existingIndex = inProgressMessages.findIndex(m => m.userId === String(msg.uid));
          
          if (existingIndex >= 0) {
            // If already exists, keep the one with the most recent timestamp
            if (msg._time > inProgressMessages[existingIndex].time) {
              inProgressMessages[existingIndex] = {
                id: `subtitle-in-progress-${msg.uid}-${msg.turn_id}`,
                type: msg.uid === 0 ? 'agent' : 'user',
                time: msg._time || Date.now(),
                content: messageText,
                contentType: 'text',
                userId: String(msg.uid),
                isOwn: msg.uid !== 0,
                isSubtitle: true,
                isInProgress: true,
                status: msg.status
              };
            }
          } else {
            // If not exists, add it
            inProgressMessages.push({
              id: `subtitle-in-progress-${msg.uid}-${msg.turn_id}`,
              type: msg.uid === 0 ? 'agent' : 'user',
              time: msg._time || Date.now(),
              content: messageText,
              contentType: 'text',
              userId: String(msg.uid),
              isOwn: msg.uid !== 0,
              isSubtitle: true,
              isInProgress: true,
              status: msg.status
            });
          }
        }
      });
    
    // Process RTM messages
    const typedMessages = rtmMessages.map((msg, index) => ({
      id: `typed-${index}-${msg.time}`,
      ...msg,
      isSubtitle: false
    }));
    
    // Combine and sort all messages by time
    const allMessages = [...subtitleMessages, ...inProgressMessages, ...typedMessages]
      .sort((a, b) => a.time - b.time);
    
    setCombinedMessages(allMessages);
    
  }, [liveSubtitles, rtmMessages]);
  
  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (rtmMessageEndRef.current) {
      rtmMessageEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [combinedMessages]);
  
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
  
  // Render a message (either subtitle or typed)
  const renderMessage = (message, index) => {
    // Get appropriate classes based on message type and status
    let messageClass = `rtm-message ${message.isOwn ? 'own-message' : 'other-message'}`;
    
    // Add specific classes for subtitle messages
    if (message.isSubtitle) {
      messageClass += ' subtitle-message';
      
      if (message.isInProgress) {
        messageClass += ' subtitle-in-progress';
      } else if (message.status === MessageStatus.END) {
        messageClass += ' subtitle-complete';
      } else if (message.status === MessageStatus.INTERRUPTED) {
        messageClass += ' subtitle-complete';
      }
    }
    
    return (
      <div key={message.id} className={messageClass}>
        <div className="rtm-message-sender">
          {message.isOwn ? 'You' : 'Agent'}
          {message.isSubtitle && ''}
          {message.isInProgress && ''}
        </div>
        <div className="rtm-message-content">
          {message.contentType === 'image' ? (
            <img 
              src={message.content} 
              className="rtm-image-content" 
              alt="Shared content"
            />
          ) : (
            message.content
          )}
        </div>
        <div className="rtm-message-time">
          {new Date(message.time).toLocaleTimeString()}
        </div>
      </div>
    );
  };
  
  return (
    <div className="rtm-container">
      <div className="rtm-messages">
        {combinedMessages.length === 0 ? (
          <div className="rtm-empty-state">
            {isConnected 
              ? "No messages yet. Start the conversation by speaking or typing!"
              : "No messages"}
          </div>
        ) : (
          <>
            {/* Render all messages in a single conversation timeline */}
            {combinedMessages.map((msg, index) => renderMessage(msg, index))}
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
          placeholder={isConnected ? "Type a message..." : "Connect to start chatting..."}
          disabled={!rtmJoined || !isConnected}
        />
        <button 
          className="rtm-send-button" 
          onClick={handleSendMessage}
          disabled={!rtmJoined || !rtmInputText.trim() || !isConnected}
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