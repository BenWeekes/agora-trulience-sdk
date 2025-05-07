import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { sendRtmMessage } from "../utils/rtmUtils";
import { MessageEngine, MessageStatus } from "../utils/messageService";
import ExpandableChatInput from "./ExpandableChatInput";

/**
 * Component for RTM chat interface with WhatsApp-like styling
 */
export const RtmChatPanel = ({
  rtmClient,
  rtmMessages,
  rtmJoined,
  agoraConfig,
  agoraClient,
  isConnected,
  processMessage,
  isFullscreen
}) => {
  const [rtmInputText, setRtmInputText] = useState("");
  const [liveSubtitles, setLiveSubtitles] = useState([]);
  const [combinedMessages, setCombinedMessages] = useState([]);
  const [pendingRtmMessages, setPendingRtmMessages] = useState([]);
  const rtmMessageEndRef = useRef(null);
  const messageEngineRef = useRef(null);

  const floatingInput = document.getElementById("floating-input");
  const staticInput = document.getElementById("static-input");

  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  // Initialize MessageEngine for subtitles with message processor
  useEffect(() => {
    if (!agoraClient || !!messageEngineRef.current || !isConnected) return;
   
    console.log("Initializing MessageEngine with client:", agoraClient);

    // Create MessageEngine instance
    if (!messageEngineRef.current) {
      messageEngineRef.current = new MessageEngine(
        agoraClient,
        "auto",
        (messageList) => {
          console.log(`Received ${messageList.length} subtitle messages`);
          // Update the subtitles when we receive updates from the MessageEngine
          if (messageList && messageList.length > 0) {
            // Process any commands in final messages
            if (processMessage) {
              messageList.forEach(msg => {
                if (msg.status === MessageStatus.END && msg.text && msg.uid === 0) {
                  msg.text = processMessage(msg.text, msg.turn_id || "");
                }
              });
            }
            
            setLiveSubtitles((prev) => {
              // Force update even if the array reference is the same
              return [...messageList];
            });
          }
        }
      );
      console.log("MessageEngine initialized:", messageEngineRef.current);
    } else {
      // Make sure we have the current message list
      if (messageEngineRef.current.messageList.length > 0) {
        setLiveSubtitles([...messageEngineRef.current.messageList]);
      }
    }

    // Cleanup on unmount
    return () => {
      if (messageEngineRef.current) {
        messageEngineRef.current.cleanup();
      }
    };
  }, [agoraClient, isConnected, processMessage]);

  // Add user-sent RTM messages to the pending list for immediate display
  useEffect(() => {
    if (rtmMessages && rtmMessages.length > 0) {
      // Only add messages that aren't already in pendingRtmMessages
      const newMessages = rtmMessages.filter(
        (msg) =>
          !pendingRtmMessages.some(
            (pending) =>
              pending.time === msg.time &&
              pending.content === msg.content &&
              pending.userId === msg.userId
          )
      );

      if (newMessages.length > 0) {
        setPendingRtmMessages((prev) => [...prev, ...newMessages]);
      }
    }
  }, [rtmMessages, pendingRtmMessages]);

  // Combine live subtitles and RTM messages into a single timeline
  useEffect(() => {
    // Process live subtitles
    const subtitleMessages = [];
    const now = Date.now(); // Current timestamp for fallback

    // Add completed and in-progress messages
    liveSubtitles.forEach((msg) => {
      // Skip empty messages (could be just commands that were processed)
      const messageText = msg.text || (msg.metadata && msg.metadata.text) || "";
      if (!messageText || messageText.trim().length === 0) {
        return;
      }

      // Ensure timestamp is valid (not 0, not NaN, not 1970)
      const msgTime = msg._time || msg.start_ms;
      const validTime =
        msgTime && new Date(msgTime).getFullYear() > 1971 ? msgTime : now;

      subtitleMessages.push({
        id: `subtitle-${msg.uid}-${msg.turn_id}-${msg.message_id || now}`,
        type: msg.uid === 0 ? "agent" : "user",
        time: validTime,
        content: messageText,
        contentType: "text",
        userId: String(msg.uid),
        isOwn: msg.uid !== 0, // User messages are "own" messages
        isSubtitle: true,
        status: msg.status,
        turn_id: msg.turn_id,
        message_id: msg.message_id,
        fromPreviousSession: !isConnected, // Mark as from previous session if not connected
      });
    });

    // Include all pending RTM messages with valid timestamps
    const typedMessages = pendingRtmMessages.map((msg, index) => {
      const validTime =
        msg.time && new Date(msg.time).getFullYear() > 1971 ? msg.time : now;
      return {
        id: `typed-${msg.userId}-${validTime}`,
        ...msg,
        time: validTime, // Ensure valid time
        isSubtitle: false,
        fromPreviousSession: !isConnected && validTime < now - 5000, // Mark older messages as from previous session
      };
    });

    // Combine and deduplicate messages
    const allMessageMap = new Map();

    // First add subtitle messages to the map (using message_id or turn_id as key)
    subtitleMessages.forEach((msg) => {
      const key = msg.message_id || `${msg.userId}-${msg.turn_id}`;
      allMessageMap.set(key, msg);
    });

    // Then add typed messages, but avoid duplicating the same content that's in a subtitle
    typedMessages.forEach((msg) => {
      // Generate a unique key
      const key = `typed-${msg.userId}-${msg.time}`;

      // Check if we already have a subtitle with similar content
      const hasSimilarSubtitle = Array.from(allMessageMap.values()).some(
        (existing) =>
          existing.isSubtitle &&
          existing.userId === msg.userId &&
          existing.content.trim() === msg.content.trim()
      );

      // Only add if no similar subtitle exists
      if (!hasSimilarSubtitle) {
        allMessageMap.set(key, msg);
      }
    });

    // Convert the map values to an array and sort by time
    const allMessages = Array.from(allMessageMap.values()).sort(
      (a, b) => a.time - b.time
    );

    console.log("Combined messages count:", allMessages.length);
    setCombinedMessages(allMessages);
  }, [liveSubtitles, pendingRtmMessages, isConnected]);

  // Force a re-render whenever the connection state changes
  useEffect(() => {
    if (isConnected && messageEngineRef.current) {
      const messageList = messageEngineRef.current.messageList;
      if (messageList.length > 0) {
        console.log("Connection status changed, forcing message update");
        setLiveSubtitles([...messageList]);
      }
    }
  }, [isConnected]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (rtmMessageEndRef.current && !isKeyboardVisible) {
      rtmMessageEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [combinedMessages]);

  // Send RTM message to the agent
  const handleSendMessage = async () => {
    if (!rtmInputText.trim() || !rtmJoined) return;

    // Prepare message for immediate display
    const sentMessage = {
      type: "user",
      time: Date.now(),
      content: rtmInputText.trim(),
      contentType: "text",
      userId: String(agoraConfig.uid),
      isOwn: true,
    };

    // Add to pending messages for immediate display
    setPendingRtmMessages((prev) => [...prev, sentMessage]);

    // Clear input before sending (for better user experience)
    const messageToSend = rtmInputText.trim();
    setRtmInputText("");

    // Actually send the message
    await sendRtmMessage(rtmClient, messageToSend, agoraConfig.uid);
  };

  // Render a message (WhatsApp style)
  const renderMessage = (message, index) => {
    // Skip empty messages
    if (!message.content || message.content.trim().length === 0) {
      return null;
    }
    
    // Get appropriate classes based on message type and status
    let messageClass = `rtm-message ${
      message.isOwn ? "own-message" : "other-message"
    }`;

    // Keep a subtle indicator for in-progress messages
    if (message.isSubtitle && message.status === MessageStatus.IN_PROGRESS) {
      messageClass += " message-in-progress";
    }

    // Add visual indicator for messages from previous session
    if (!isConnected && message.fromPreviousSession) {
      messageClass += " previous-session";
    }

    // Ensure we have a valid time
    const messageTime = message.time || Date.now();
    const messageDate = new Date(messageTime);
    const isValidDate = messageDate.getFullYear() > 1971;

    return (
      <div key={message.id || index} className={messageClass}>
        <div className="rtm-message-content">
          {message.contentType === "image" ? (
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
          {isValidDate
            ? messageDate.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })
            : new Date().toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
        </div>
      </div>
    );
  };

  // Show a date divider between messages on different days
  const renderMessageGroup = () => {
    if (combinedMessages.length === 0) return null;

    const result = [];
    let lastDate = null;
    const now = new Date();

    combinedMessages.forEach((message, index) => {
      // Skip empty messages
      if (!message.content || message.content.trim().length === 0) {
        return;
      }
      
      // Ensure the message time is valid and not in 1970
      const messageTime = message.time || Date.now();
      const messageDate = new Date(messageTime);

      // Skip date dividers for invalid dates or dates from 1970
      const isValidDate = messageDate.getFullYear() > 1971;
      const messageLocaleDateString = isValidDate
        ? messageDate.toLocaleDateString()
        : now.toLocaleDateString();

      // Add date divider if date has changed and it's valid
      if (messageLocaleDateString !== lastDate && isValidDate) {
        result.push(
          <div key={`date-${messageLocaleDateString}`} className="date-divider">
            {messageLocaleDateString}
          </div>
        );
        lastDate = messageLocaleDateString;
      }

      // Add the message
      const renderedMessage = renderMessage(message, index);
      if (renderedMessage) {
        result.push(renderedMessage);
      }
    });

    return result;
  };

  return (
    <div className={`rtm-container  ${isFullscreen ? "hidden": ""}`} >
      <div className="rtm-messages">
        {combinedMessages.length === 0 ? (
          <div className="rtm-empty-state">
            {isConnected
              ? "No messages yet. Start the conversation by speaking or typing!"
              : "No messages"}
          </div>
        ) : (
          <>{renderMessageGroup()}</>
        )}
        <div ref={rtmMessageEndRef} />
      </div>
      <div id="static-input"></div>

      {floatingInput &&
        staticInput &&
        createPortal(
          <ExpandableChatInput 
                rtmInputText={rtmInputText}
                setRtmInputText={setRtmInputText}
                handleSendMessage={handleSendMessage}
                disabled={!rtmJoined || !isConnected}
                isKeyboardVisible={isKeyboardVisible} 
                setIsKeyboardVisible={setIsKeyboardVisible}
              />
          ,
          isKeyboardVisible ? floatingInput : staticInput
        )}
    </div>
  );
};