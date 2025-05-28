import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
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
  isConnectInitiated,
  processMessage,
  isFullscreen,
  registerDirectSend,
  urlParams,
  getMessageChannelName // Changed from channelName to getMessageChannelName function
}) => {
  const [rtmInputText, setRtmInputText] = useState("");
  const [liveSubtitles, setLiveSubtitles] = useState([]);
  const [combinedMessages, setCombinedMessages] = useState([]);
  const [pendingRtmMessages, setPendingRtmMessages] = useState([]);
  const [preservedSubtitleMessages, setPreservedSubtitleMessages] = useState([]); // Preserve subtitle history
  const rtmMessageEndRef = useRef(null);
  const messageEngineRef = useRef(null);

  const floatingInput = document.getElementById("floating-input");
  const staticInput = document.getElementById("static-input");

  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  // Determine if we're in purechat mode
  const isPureChatMode = urlParams?.purechat === true;

  // Determine if chat should be enabled - either connected normally OR purechat mode with RTM
  const isChatEnabled = isConnectInitiated || (isPureChatMode && rtmClient);

  // Handle disconnection in purechat mode - preserve messages
  useEffect(() => {
    // When disconnecting in purechat mode, preserve current subtitle messages
    if (isPureChatMode && !isConnectInitiated && liveSubtitles.length > 0) {
      console.log("Preserving subtitle messages on purechat disconnect:", liveSubtitles.length);
      
      const messagesToPreserve = liveSubtitles.filter(msg => {
        const messageText = msg.text || (msg.metadata && msg.metadata.text) || "";
        return messageText && messageText.trim().length > 0;
      });
      
      if (messagesToPreserve.length > 0) {
        setPreservedSubtitleMessages(prevPreserved => {
          const newCompleted = messagesToPreserve.filter(newMsg => 
            !prevPreserved.some(preserved => 
              preserved.message_id === newMsg.message_id || 
              (preserved.turn_id === newMsg.turn_id && preserved.uid === newMsg.uid && 
               preserved.text === (newMsg.text || (newMsg.metadata && newMsg.metadata.text) || ""))
            )
          );
          console.log("Adding", newCompleted.length, "new preserved messages");
          return [...prevPreserved, ...newCompleted];
        });
      }
      
      // Clear live subtitles after preserving
      setLiveSubtitles([]);
    }
  }, [isPureChatMode, isConnectInitiated, liveSubtitles]);

  const directSendMessage = useCallback(async (message, skipHistory = false, channel = null) => {
    if (!message.trim()) return false;
  
    try {
      // Use provided channel parameter, or get from the message channel function, or default to empty string
      const targetChannel = channel || (getMessageChannelName ? getMessageChannelName() : '') || '';
      const publishTarget = targetChannel ? `agent-${targetChannel}` : 'agent';
      
      console.log("Direct send using rtmClient:", !!rtmClient, "Skip history:", skipHistory, "Target:", publishTarget);
      
      // Check if rtmClient is available, and try to send the message
      if (rtmClient) {
        const options = {
          customType: "user.transcription",
          channelType: "USER",
        };
        
        // Send message to the channel using the channel-specific target
        await rtmClient.publish(publishTarget, message.trim(), options);
        console.log("Message sent successfully via direct send to:", publishTarget);
  
        // Always add user messages to pending messages for display (removed the 1==2 condition)
        if (!skipHistory) {
          setPendingRtmMessages((prev) => [...prev, {
            type: "user",
            time: Date.now(),
            content: message.trim(),
            contentType: "text",
            userId: String(agoraConfig.uid),
            isOwn: true,
          }]);
        }
  
        return true;
      } else {
        console.error("Direct send failed - rtmClient not available");
        return false;
      }
    } catch (error) {
      console.error("Failed to send message via direct send:", error);
      return false;
    }
  }, [rtmClient, agoraConfig.uid, getMessageChannelName]);

  
  // Register the direct send function when available
  useEffect(() => {
    if (registerDirectSend && rtmClient) {
      console.log("Registering direct send function with rtmClient");
      registerDirectSend(directSendMessage);
    }
  }, [registerDirectSend, rtmClient, directSendMessage]);

  // Initialize MessageEngine for subtitles with message processor
  useEffect(() => {
    // Don't skip MessageEngine initialization in purechat mode if we're connected to agent
    // Skip only if we're in purechat mode AND not connected to agent
    if (isPureChatMode && !isConnectInitiated) {
      console.log("Skipping MessageEngine initialization - purechat mode without agent connection");
      return;
    }

    if (!agoraClient) {
      console.log("MessageEngine init blocked - no agoraClient");
      return;
    }
    
    if (messageEngineRef.current) {
      console.log("MessageEngine init blocked - already exists");
      return;
    }
    
    if (!isConnectInitiated) {
      console.log("MessageEngine init blocked - not connected");
      return;
    }
   
    console.log("Initializing MessageEngine with client:", agoraClient, "purechat mode:", isPureChatMode);

    // Create MessageEngine instance
    if (!messageEngineRef.current) {
      messageEngineRef.current = new MessageEngine(
        agoraClient,
        "auto",
        (messageList) => {
          console.log(`Received ${messageList.length} subtitle messages (purechat: ${isPureChatMode})`);
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
              const newMessages = [...messageList];
              
              // Preserve completed messages to preservedSubtitleMessages
              const completedMessages = newMessages.filter(msg => 
                msg.status === MessageStatus.END && msg.text && msg.text.trim().length > 0
              );
              
              if (completedMessages.length > 0) {
                setPreservedSubtitleMessages(prevPreserved => {
                  // Add new completed messages that aren't already preserved
                  const newCompleted = completedMessages.filter(newMsg => 
                    !prevPreserved.some(preserved => 
                      preserved.message_id === newMsg.message_id || 
                      (preserved.turn_id === newMsg.turn_id && preserved.uid === newMsg.uid)
                    )
                  );
                  return [...prevPreserved, ...newCompleted];
                });
              }
              
              return newMessages;
            });
          }
        }
      );
      console.log("MessageEngine initialized successfully:", !!messageEngineRef.current, "purechat mode:", isPureChatMode);
    } else {
      // Make sure we have the current message list
      if (messageEngineRef.current.messageList.length > 0) {
        setLiveSubtitles([...messageEngineRef.current.messageList]);
      }
    }

    // Cleanup on unmount
    return () => {
      if (messageEngineRef.current) {
        console.log("Cleaning up MessageEngine");
        messageEngineRef.current.cleanup();
        messageEngineRef.current = null;
      }
    };
  }, [agoraClient, isConnectInitiated, processMessage, isPureChatMode]);

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
    // In purechat mode and NOT connected to agent, combine RTM messages with preserved subtitle messages
    if (isPureChatMode && !isConnectInitiated) {
      const typedMessages = pendingRtmMessages.map((msg, index) => {
        const validTime =
          msg.time && new Date(msg.time).getFullYear() > 1971 ? msg.time : Date.now();
        return {
          id: `typed-${msg.userId}-${validTime}`,
          ...msg,
          time: validTime,
          isSubtitle: false,
          fromPreviousSession: false,
        };
      });

      // Also include preserved subtitle messages when disconnected in purechat mode
      const preservedSubtitleMessagesForDisplay = preservedSubtitleMessages.map((msg) => {
        const messageText = msg.text || (msg.metadata && msg.metadata.text) || "";
        const msgTime = msg._time || msg.start_ms;
        const validTime = msgTime && new Date(msgTime).getFullYear() > 1971 ? msgTime : Date.now();

        return {
          id: `preserved-subtitle-${msg.uid}-${msg.turn_id}-${msg.message_id || validTime}`,
          type: msg.uid === 0 ? "agent" : "user",
          time: validTime,
          content: messageText,
          contentType: "text",
          userId: String(msg.uid),
          isOwn: msg.uid !== 0,
          isSubtitle: true,
          status: MessageStatus.END,
          turn_id: msg.turn_id,
          message_id: msg.message_id,
          fromPreviousSession: true,
        };
      });

      // Combine both RTM and preserved subtitle messages
      const allMessages = [...typedMessages, ...preservedSubtitleMessagesForDisplay];
      setCombinedMessages(allMessages.sort((a, b) => a.time - b.time));
      return;
    }

    // For normal mode OR purechat mode with agent connected, combine all sources
    // Process live subtitles AND preserved subtitle messages
    const subtitleMessages = [];
    const now = Date.now(); // Current timestamp for fallback

    // First add preserved subtitle messages (from previous connections)
    preservedSubtitleMessages.forEach((msg) => {
      const messageText = msg.text || (msg.metadata && msg.metadata.text) || "";
      if (!messageText || messageText.trim().length === 0) {
        return;
      }

      const msgTime = msg._time || msg.start_ms;
      const validTime =
        msgTime && new Date(msgTime).getFullYear() > 1971 ? msgTime : now;

      subtitleMessages.push({
        id: `preserved-subtitle-${msg.uid}-${msg.turn_id}-${msg.message_id || now}`,
        type: msg.uid === 0 ? "agent" : "user",
        time: validTime,
        content: messageText,
        contentType: "text",
        userId: String(msg.uid),
        isOwn: msg.uid !== 0,
        isSubtitle: true,
        status: MessageStatus.END, // Preserved messages are always complete
        turn_id: msg.turn_id,
        message_id: msg.message_id,
        fromPreviousSession: !isConnectInitiated,
      });
    });

    // Then add current live subtitles
    liveSubtitles.forEach((msg) => {
      // Skip empty messages (could be just commands that were processed)
      const messageText = msg.text || (msg.metadata && msg.metadata.text) || "";
      if (!messageText || messageText.trim().length === 0) {
        return;
      }

      // Skip if this message is already in preserved messages
      const alreadyPreserved = preservedSubtitleMessages.some(preserved => 
        preserved.message_id === msg.message_id || 
        (preserved.turn_id === msg.turn_id && preserved.uid === msg.uid && preserved.text === messageText)
      );
      
      if (alreadyPreserved) {
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
        fromPreviousSession: !isConnectInitiated, // Mark as from previous session if not connected
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
        fromPreviousSession: !isConnectInitiated && validTime < now - 5000, // Mark older messages as from previous session
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

    console.log("Combined messages count:", allMessages.length, "Subtitles:", subtitleMessages.length, "RTM:", typedMessages.length, "Preserved:", preservedSubtitleMessages.length);
    setCombinedMessages(allMessages);
  }, [liveSubtitles, pendingRtmMessages, preservedSubtitleMessages, isConnectInitiated, isPureChatMode]);

  // Force a re-render whenever the connection state changes
  useEffect(() => {
    if (isConnectInitiated && messageEngineRef.current && !isPureChatMode) {
      const messageList = messageEngineRef.current.messageList;
      if (messageList.length > 0) {
        console.log("Connection status changed, forcing message update");
        setLiveSubtitles([...messageList]);
      }
    }
  }, [isConnectInitiated, isPureChatMode]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (rtmMessageEndRef.current && !isKeyboardVisible) {
      rtmMessageEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [combinedMessages, isKeyboardVisible]);

  // Send RTM message to the agent
  const handleSendMessage = async () => {
    if (!rtmInputText.trim()) return;

    // Clear input before sending (for better user experience)
    const messageToSend = rtmInputText.trim();
    setRtmInputText("");

    // Actually send the message (channel will be handled by directSendMessage)
    await directSendMessage(messageToSend);
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
    if (!isConnectInitiated && message.fromPreviousSession) {
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

  const getEmptyStateMessage = () => {
    if (isPureChatMode) {
      return isChatEnabled 
        ? "Chat connected. Start typing to send messages!" 
        : "Connecting to chat...";
    }
    return isConnectInitiated
      ? "No messages yet. Start the conversation by speaking or typing!"
      : "No messages";
  };

  return (
    <div className={`rtm-container  ${isFullscreen ? "hidden": ""}`} >
      <div className="rtm-messages">
        {combinedMessages.length === 0 ? (
          <div className="rtm-empty-state">
            {getEmptyStateMessage()}
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
                disabled={!isChatEnabled}
                isKeyboardVisible={isKeyboardVisible} 
                setIsKeyboardVisible={setIsKeyboardVisible}
                isPureChatMode={isPureChatMode}
              />
          ,
          isKeyboardVisible ? floatingInput : staticInput
        )}
    </div>
  );
};