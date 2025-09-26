// react/src/components/RtmChatPanel.js
import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { MessageEngine, MessageStatus } from "../utils/messageService";
import ExpandableChatInput from "./ExpandableChatInput";
import logger from "../utils/logger";
import { sanitizeCommandMessage } from "../utils/trulienceUtils";

/**
 * Shared function to process and filter RTM messages
 * Handles command processing and determines if message should be displayed in chat
 */
const processRtmMessage = (message, currentUserId, processMessage, urlParams, isConnectInitiated) => {
  const isFromAgent = message.type === 'agent' || message.userId !== String(currentUserId) || !message.isOwn;

  // Only process commands for agent messages with text content
  if (isFromAgent && processMessage && message.contentType === 'text') {
    const shouldProcessCommands = !(urlParams.purechat && !isConnectInitiated);

    if (shouldProcessCommands) {
      const processedText = processMessage(message.content, message.turn_id || "");

      // If message becomes empty after command processing, don't display it
      if (processedText === "" || processedText.trim() === "") {
        logger.log("Message was entirely commands, not displaying:", message.content);
        return null; // Don't display this message
      }

      // Always sanitize the processed text to remove any remaining <trl- tags
      const sanitizedText = sanitizeCommandMessage(processedText);

      // Return message with processed and sanitized content
      return {
        ...message,
        content: sanitizedText
      };
    }
  }

  // For user messages or when not processing commands, still sanitize to be safe
  if (message.contentType === 'text' && message.content) {
    return {
      ...message,
      content: sanitizeCommandMessage(message.content)
    };
  }

  // Return message as-is for non-text content
  return message;
};

/**
 * Component for RTM chat interface with WhatsApp-like styling and typing indicators
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
  getMessageChannelName
}) => {
  const [rtmInputText, setRtmInputText] = useState("");
  const [liveSubtitles, setLiveSubtitles] = useState([]);
  const [combinedMessages, setCombinedMessages] = useState([]);
  const [pendingRtmMessages, setPendingRtmMessages] = useState([]);
  const [preservedSubtitleMessages, setPreservedSubtitleMessages] = useState([]);
  const [typingUsers, setTypingUsers] = useState(new Set());
  const rtmMessageEndRef = useRef(null);
  const messageEngineRef = useRef(null);

  const floatingInput = document.getElementById("floating-input");
  const staticInput = document.getElementById("static-input");

  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  // Determine if we're in purechat mode
  const isPureChatMode = urlParams?.purechat === true;

  // Determine if chat should be enabled - either connected normally OR purechat mode with RTM
  const isChatEnabled = isConnectInitiated || (isPureChatMode && rtmClient);

  // Get avatar profile URL for agent messages
  const getAvatarProfileUrl = useCallback((userId) => {
    // Only return avatar URL for agent messages (userId === '0' or similar)
    if (userId === '0' || userId === 0 || (typeof userId === 'string' && userId.toLowerCase().includes('agent'))) {
      const avatarId = urlParams?.avatarId || process.env.REACT_APP_TRULIENCE_AVATAR_ID;
      if (avatarId) {
        return `${process.env.REACT_APP_TRULIENCE_PROFILE_BASE}/${avatarId}/profile.jpg`;
      }
    }
    return null;
  }, [urlParams?.avatarId]);

  // Extract sender name from userId (e.g., "bob-sky" -> "bob")
  const getSenderName = useCallback((userId) => {
    if (!userId || typeof userId !== 'string') return null;
    
    // Split by hyphen and take the first part
    const parts = userId.split('-');
    return parts[0] || userId;
  }, []);

  // Get initial from sender name
  const getSenderInitial = useCallback((userId) => {
    const name = getSenderName(userId);
    return name ? name.charAt(0).toUpperCase() : '?';
  }, [getSenderName]);

  // Generate consistent color based on full userId
  const getSenderColor = useCallback((userId) => {
    if (!userId || typeof userId !== 'string') return '#999999';
    
    // Simple hash function to generate color from string
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      hash = userId.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    // Convert to HSL for better color distribution
    const hue = Math.abs(hash) % 360;
    const saturation = 65; // Good saturation for readability
    const lightness = 45; // Good contrast with white text
    
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  }, []);

  // Handle disconnection in purechat mode - preserve messages
  useEffect(() => {
    if (isPureChatMode && !isConnectInitiated && liveSubtitles.length > 0) {
      logger.log("Preserving subtitle messages on purechat disconnect:", liveSubtitles.length);
      
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
          logger.log("Adding", newCompleted.length, "new preserved messages");
          return [...prevPreserved, ...newCompleted];
        });
      }
      
      setLiveSubtitles([]);
    }
  }, [isPureChatMode, isConnectInitiated, liveSubtitles]);

  const directSendMessage = useCallback(async (message, skipHistory = false, channel = null) => {
    if (!message.trim()) return false;

    try {
      const targetChannel = channel || (getMessageChannelName ? getMessageChannelName() : '') || '';
      const publishTarget = targetChannel ? `agent-${targetChannel}` : 'agent';
      
      logger.log("Direct send using rtmClient:", !!rtmClient, "Skip history:", skipHistory, "Target:", publishTarget);
      
      if (rtmClient) {
        const options = {
          customType: "user.transcription",
          channelType: "USER",
        };
        
        const messagePayload = JSON.stringify({
        message: message.trim(),
        priority: "APPEND"
      });
        
        await rtmClient.publish(publishTarget,messagePayload, options);
        logger.log("append Message sent successfully via direct send to:", publishTarget);

        // Only add to local history if:
        // 1. Not explicitly skipping history AND
        // 2. We're in purechat mode without full agent connection
        const shouldAddToHistory = !skipHistory && (isPureChatMode && !isConnectInitiated);
        
        if (shouldAddToHistory) {
          logger.log("Adding user message to local history (purechat mode)");
          setPendingRtmMessages((prev) => [...prev, {
            type: "user",
            time: Date.now(),
            content: message.trim(),
            contentType: "text",
            userId: String(agoraConfig.uid),
            isOwn: true,
          }]);
        } else {
          logger.log("Not adding to local history - message will echo back from agent or skipHistory=true");
        }

        return true;
      } else {
        logger.error("Direct send failed - rtmClient not available");
        return false;
      }
    } catch (error) {
      logger.error("Failed to send message via direct send:", error);
      return false;
    }
  }, [rtmClient, agoraConfig.uid, getMessageChannelName, isPureChatMode, isConnectInitiated]);  

  // Register the direct send function when available
  useEffect(() => {
    if (registerDirectSend && rtmClient) {
      logger.log("Registering direct send function with rtmClient");
      registerDirectSend(directSendMessage);
    }
  }, [registerDirectSend, rtmClient, directSendMessage]);

  const handleRtmMessageCallback = useCallback(
    (event) => {
      logger.warn('handleRtmMessageCallback', event);
      
      try {
        const { message, messageType, timestamp, publisher } = event;
        
        logger.log("[RTM] Message received:", {
          publisher,
          currentUserId: agoraConfig.uid,
          messageType,
          timestamp,
          message: typeof message === 'string' ? message : '[binary data]'
        });
        
        const isFromAgent = publisher !== String(agoraConfig.uid);
        
        if (messageType === "STRING") {
          let messageToProcess = null;
          
          try {
            const parsedMsg = JSON.parse(message);
            
            // Handle typing indicators
            if (parsedMsg.type === "typing_start") {
              if (isFromAgent) {
                setTypingUsers(prev => new Set([...prev, publisher]));
                setTimeout(() => {
                  setTypingUsers(prev => {
                    const newSet = new Set(prev);
                    newSet.delete(publisher);
                    return newSet;
                  });
                }, 15000);
              }
              return;
            }
            
            // Handle image messages
            if (parsedMsg.img) {
              messageToProcess = {
                type: isFromAgent ? 'agent' : 'user',
                time: timestamp || Date.now(),
                content: parsedMsg.img,
                contentType: 'image',
                userId: publisher,
                isOwn: !isFromAgent
              };
            }
            // Handle text messages from JSON
            else if (parsedMsg.text !== undefined) {
              messageToProcess = {
                type: isFromAgent ? 'agent' : 'user',
                time: timestamp || Date.now(),
                content: parsedMsg.text,
                contentType: 'text',
                userId: publisher,
                isOwn: !isFromAgent,
                turn_id: parsedMsg.turn_id
              };
            }
            // Handle other JSON messages
            else {
              messageToProcess = {
                type: isFromAgent ? 'agent' : 'user',
                time: timestamp || Date.now(),
                content: message,
                contentType: 'text',
                userId: publisher,
                isOwn: !isFromAgent
              };
            }
            
          } catch (parseError) {
            // Not valid JSON, treat as plain text
            messageToProcess = {
              type: isFromAgent ? 'agent' : 'user',
              time: timestamp || Date.now(),
              content: message,
              contentType: 'text',
              userId: publisher,
              isOwn: !isFromAgent
            };
          }
          
          // Process the message through shared logic
          if (messageToProcess) {
            // Clear typing indicator for any real message from agent
            if (isFromAgent) {
              setTypingUsers(prev => {
                const newSet = new Set(prev);
                newSet.delete(publisher);
                return newSet;
              });
            }
            
            const processedMessage = processRtmMessage(
              messageToProcess, 
              agoraConfig.uid, 
              processMessage, 
              urlParams, 
              isConnectInitiated
            );
            
            if (processedMessage) {
              setPendingRtmMessages(prev => [...prev, processedMessage]);
            }
          }
          return;
        }
        
        // Handle binary messages
        if (messageType === "BINARY") {
          try {
            const decoder = new TextDecoder("utf-8");
            const decodedMessage = decoder.decode(message);
            
            // Clear typing indicator
            if (isFromAgent) {
              setTypingUsers(prev => {
                const newSet = new Set(prev);
                newSet.delete(publisher);
                return newSet;
              });
            }
            
            let messageToProcess = null;
            
            try {
              const parsedMsg = JSON.parse(decodedMessage);
              
              if (parsedMsg.text !== undefined) {
                messageToProcess = {
                  type: isFromAgent ? 'agent' : 'user',
                  time: timestamp || Date.now(),
                  content: parsedMsg.text,
                  contentType: 'text',
                  userId: publisher,
                  isOwn: !isFromAgent,
                  turn_id: parsedMsg.turn_id
                };
              }
            } catch {
              // Not valid JSON, use decoded message as plain text
              messageToProcess = {
                type: isFromAgent ? 'agent' : 'user',
                time: timestamp || Date.now(),
                content: decodedMessage,
                contentType: 'text',
                userId: publisher,
                isOwn: !isFromAgent
              };
            }
            
            // Process through shared logic
            if (messageToProcess) {
              const processedMessage = processRtmMessage(
                messageToProcess, 
                agoraConfig.uid, 
                processMessage, 
                urlParams, 
                isConnectInitiated
              );
              
              if (processedMessage) {
                setPendingRtmMessages(prev => [...prev, processedMessage]);
              }
            }
          } catch (error) {
            logger.error("[RTM] Error processing binary message:", error);
          }
        }
      } catch (error) {
        logger.error("Error processing RTM message:", error);
      }
    },
    [agoraConfig.uid, processMessage, urlParams, isConnectInitiated]
  );

  // Initialize MessageEngine for subtitles with message processor
  useEffect(() => {
    if (isPureChatMode && !isConnectInitiated) {
      logger.log("Skipping MessageEngine initialization - purechat mode without agent connection");
      return;
    }

    if (!agoraClient) {
      logger.log("MessageEngine init blocked - no agoraClient");
      return;
    }
    
    if (messageEngineRef.current) {
      logger.log("MessageEngine init blocked - already exists");
      return;
    }
    
    if (!isConnectInitiated) {
      logger.log("MessageEngine init blocked - not connected");
      return;
    }
   
    logger.log("Initializing MessageEngine with client:", agoraClient, "purechat mode:", isPureChatMode);

    if (!messageEngineRef.current) {
      messageEngineRef.current = new MessageEngine(
        agoraClient,
        "auto",
        (messageList) => {
          logger.log(`Received ${messageList.length} subtitle messages (purechat: ${isPureChatMode})`);
          if (messageList && messageList.length > 0) {
            if (processMessage) {
              messageList.forEach(msg => {
                if (msg.status === MessageStatus.END && msg.text && msg.uid === 0) {
                  msg.text = processMessage(msg.text, msg.turn_id || "");
                }
              });
            }
            
            setLiveSubtitles((prev) => {
              const newMessages = [...messageList];
              
              const completedMessages = newMessages.filter(msg => 
                msg.status === MessageStatus.END && msg.text && msg.text.trim().length > 0
              );
              
              if (completedMessages.length > 0) {
                setPreservedSubtitleMessages(prevPreserved => {
                  const newCompleted = completedMessages.filter(newMsg =>
                    !prevPreserved.some(preserved =>
                      preserved.message_id === newMsg.message_id
                    )
                  );
                  return [...prevPreserved, ...newCompleted];
                });
              }
              
              return newMessages;
            });
          }
        },
        urlParams // Pass URL parameters to MessageEngine
      );
      logger.log("MessageEngine initialized successfully:", !!messageEngineRef.current, "purechat mode:", isPureChatMode);
    } else {
      if (messageEngineRef.current.messageList.length > 0) {
        setLiveSubtitles([...messageEngineRef.current.messageList]);
      }
    }

    return () => {
      if (messageEngineRef.current) {
        logger.log("Cleaning up MessageEngine");
        messageEngineRef.current.cleanup();
        messageEngineRef.current = null;
      }
    };
  }, [agoraClient, isConnectInitiated, processMessage, isPureChatMode, urlParams]);

  // useEffect(() => {
  //   if (rtmMessages && rtmMessages.length > 0) {
  //     const newMessages = rtmMessages.filter(
  //       (msg) =>
  //         !pendingRtmMessages.some(
  //           (pending) =>
  //             pending.time === msg.time &&
  //             pending.content === msg.content &&
  //             pending.userId === msg.userId
  //         )
  //     );

  //     if (newMessages.length > 0) {
  //       // Process all new messages through shared logic
  //       const processedMessages = newMessages
  //         .map(msg => processRtmMessage(msg, agoraConfig.uid, sanitizeCommandMessage, urlParams, isConnectInitiated))
  //         .filter(msg => msg !== null); // Remove messages that were filtered out (commands only)

  //       if (processedMessages.length > 0) {
  //         setPendingRtmMessages((prev) => [...prev, ...processedMessages]);
  //       } else {
  //         logger.log("All new messages were command-only, none added to chat");
  //       }
  //     }
  //   }
  // }, [rtmMessages, pendingRtmMessages, agoraConfig.uid, processMessage, urlParams, isConnectInitiated]);

  // Combine live subtitles and RTM messages into a single timeline
  useEffect(() => {
    if (isPureChatMode && !isConnectInitiated) {
      const typedMessages = pendingRtmMessages
        .filter(msg => {
          // Filter out typing indicator messages
          try {
            const parsed = JSON.parse(msg.content);
            return parsed.type !== "typing_start";
          } catch {
            return true; // Keep non-JSON messages
          }
        })
        .map((msg, index) => {
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
          userId: msg.user_id || String(msg.uid), // Use user_id if available, fallback to uid
          isOwn: msg.uid !== 0, // All non-agent messages on right
          isSubtitle: true,
          status: MessageStatus.END,
          turn_id: msg.turn_id,
          message_id: msg.message_id,
          fromPreviousSession: true,
        };
      });

      const allMessages = [...typedMessages, ...preservedSubtitleMessagesForDisplay];
      setCombinedMessages(allMessages.sort((a, b) => a.time - b.time));
      return;
    }

    const subtitleMessages = [];
    const now = Date.now();

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
        userId: msg.user_id || String(msg.uid), // Use user_id if available, fallback to uid
        isOwn: msg.uid !== 0, // All non-agent messages on right
        isSubtitle: true,
        status: MessageStatus.END,
        turn_id: msg.turn_id,
        message_id: msg.message_id,
        fromPreviousSession: !isConnectInitiated,
      });
    });

    liveSubtitles.forEach((msg) => {
      let messageText = msg.text || (msg.metadata && msg.metadata.text) || "";
      if (!messageText || messageText.trim().length === 0) {
        return;
      }

      const alreadyPreserved = preservedSubtitleMessages.some(preserved => 
        preserved.message_id === msg.message_id || 
        (preserved.turn_id === msg.turn_id && preserved.uid === msg.uid && preserved.text === messageText)
      );
      
      if (alreadyPreserved) {
        return;
      }

      const msgTime = msg._time || msg.start_ms;
      const validTime =
        msgTime && new Date(msgTime).getFullYear() > 1971 ? msgTime : now;

      // message with status not ended, need to clear the tag while printing
      messageText = sanitizeCommandMessage(messageText)
      
      if(!messageText) return

      subtitleMessages.push({
        id: `subtitle-${msg.uid}-${msg.turn_id}-${msg.message_id || now}`,
        type: msg.uid === 0 ? "agent" : "user",
        time: validTime,
        content: messageText,
        contentType: "text",
        userId: msg.user_id || String(msg.uid), // Use user_id if available, fallback to uid
        isOwn: msg.uid !== 0, // All non-agent messages on right
        isSubtitle: true,
        status: msg.status,
        turn_id: msg.turn_id,
        message_id: msg.message_id,
        fromPreviousSession: !isConnectInitiated,
      });
    });

    const typedMessages = pendingRtmMessages
      .filter(msg => {
        // Filter out typing indicator messages
        try {
          const parsed = JSON.parse(msg.content);
          return parsed.type !== "typing_start";
        } catch {
          return true; // Keep non-JSON messages
        }
      })
      .map((msg, index) => {
        const validTime =
          msg.time && new Date(msg.time).getFullYear() > 1971 ? msg.time : now;
        return {
          id: `typed-${msg.userId}-${validTime}`,
          ...msg,
          time: validTime,
          isSubtitle: false,
          fromPreviousSession: !isConnectInitiated && validTime < now - 5000,
        };
      });

    const allMessageMap = new Map();

    subtitleMessages.forEach((msg) => {
      const key = msg.message_id || `${msg.userId}-${msg.turn_id}`;
      allMessageMap.set(key, msg);
    });

    typedMessages.forEach((msg) => {
      const key = `typed-${msg.userId}-${msg.time}`;

      const hasSimilarSubtitle = Array.from(allMessageMap.values()).some(
        (existing) =>
          existing.isSubtitle &&
          existing.userId === msg.userId &&
          existing.content.trim() === msg.content.trim()
      );

      if (!hasSimilarSubtitle) {
        allMessageMap.set(key, msg);
      }
    });

    const allMessages = Array.from(allMessageMap.values()).sort(
      (a, b) => a.time - b.time
    );

    logger.log("Combined messages count:", allMessages.length, "Subtitles:", subtitleMessages.length, "RTM:", typedMessages.length, "Preserved:", preservedSubtitleMessages.length);
    setCombinedMessages(allMessages);
  }, [liveSubtitles, pendingRtmMessages, preservedSubtitleMessages, isConnectInitiated, isPureChatMode]);

  // Force a re-render whenever the connection state changes
  useEffect(() => {
    if (isConnectInitiated && messageEngineRef.current && !isPureChatMode) {
      const messageList = messageEngineRef.current.messageList;
      if (messageList.length > 0) {
        logger.log("Connection status changed, forcing message update");
        setLiveSubtitles([...messageList]);
      }
    }
  }, [isConnectInitiated, isPureChatMode]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (rtmMessageEndRef.current && !isKeyboardVisible) {
      rtmMessageEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [combinedMessages, isKeyboardVisible, typingUsers]);

  // Send RTM message to the agent
  const handleSendMessage = async () => {
    if (!rtmInputText.trim()) return;

    const messageToSend = rtmInputText.trim();
    setRtmInputText("");

    await directSendMessage(messageToSend);
  };

  // Set up RTM message listener
  useEffect(() => {
    if (rtmClient) {
      rtmClient.addEventListener("message", handleRtmMessageCallback);
      
      return () => {
        rtmClient.removeEventListener("message", handleRtmMessageCallback);
      };
    }
  }, [rtmClient, handleRtmMessageCallback]);

  // Render typing indicator
  const renderTypingIndicator = () => {
    if (typingUsers.size === 0) return null;

    const typingUserId = [...typingUsers][0]; // Get first typing user
    const avatarUrl = getAvatarProfileUrl(typingUserId);
    const showInitialCircle = !avatarUrl && typingUserId !== '0';

    return (
      <div key="typing-indicator" className="rtm-message other-message typing-indicator">
        {avatarUrl && (
          <img
            src={avatarUrl}
            alt="Avatar"
            className="rtm-message-avatar"
            onError={(e) => {
              e.target.style.display = 'none';
            }}
          />
        )}
        {showInitialCircle && (
          <div 
            className="rtm-message-initial-circle"
            style={{ backgroundColor: getSenderColor(typingUserId) }}
          >
            {getSenderInitial(typingUserId)}
          </div>
        )}
        <div className="rtm-message-content">
          <div className="typing-dots">
            <div className="typing-dot"></div>
            <div className="typing-dot"></div>
            <div className="typing-dot"></div>
          </div>
        </div>
      </div>
    );
  };

  // Render a message (WhatsApp style)
  const renderMessage = (message, index) => {
    if (!message.content || message.content.trim().length === 0) {
      return null;
    }
    
    const isAgentMessage = message.type === 'agent';
    let messageClass = `rtm-message ${message.isOwn ? "own-message" : "other-message"}`;

    if (message.isSubtitle && message.status === MessageStatus.IN_PROGRESS) {
      messageClass += " message-in-progress";
    }

    if (!isConnectInitiated && message.fromPreviousSession) {
      messageClass += " previous-session";
    }

    const messageTime = message.time || Date.now();
    const messageDate = new Date(messageTime);
    const isValidDate = messageDate.getFullYear() > 1971;

    // Determine what to show for each message
    let avatarUrl = null;
    let showInitialCircle = false;
    let senderInitial = null;
    let senderColor = null;

    // Debug logging to understand the message structure
    logger.log("renderMessage debug:", {
      userId: message.userId,
      type: message.type,
      isOwn: message.isOwn,
      isAgentMessage,
      content: message.content?.substring(0, 30) + "..."
    });

    // For agent messages, always show avatar photo (never initial circle)
    if (isAgentMessage) {
      avatarUrl = getAvatarProfileUrl(message.userId);
    } 
    // For user messages, show initial circle ONLY if name param is set
    else if (urlParams?.name || agoraConfig.name) {
      showInitialCircle = true;
      
      // Always extract initial from the actual sender's userId
      // This ensures we show the correct initial regardless of message side
      senderInitial = getSenderInitial(message.userId);
      senderColor = getSenderColor(message.userId);
    }

    logger.log("Message display decision:", {
      showAvatar: !!avatarUrl,
      showInitialCircle,
      senderInitial,
      senderColor,
      userId: message.userId
    });

    return (
      <div key={message.id || index} className={messageClass}>
        {!message.isOwn && avatarUrl && (
          <img
            src={avatarUrl}
            alt="Avatar"
            className="rtm-message-avatar"
            onError={(e) => {
              e.target.style.display = 'none';
            }}
          />
        )}
        {showInitialCircle && (
          <div 
            className="rtm-message-initial-circle"
            style={{ backgroundColor: senderColor }}
          >
            {senderInitial}
          </div>
        )}
        <div className="rtm-message-content">
          {message.contentType === "image" ? (
            <img
              src={message.content}
              className="rtm-image-content"
              alt="Shared content"
            />
          ) : (
            sanitizeCommandMessage(message.content || "")
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
    if (combinedMessages.length === 0 && typingUsers.size === 0) return null;

    const result = [];
    let lastDate = null;
    const now = new Date();

    combinedMessages.forEach((message, index) => {
      if (!message.content || message.content.trim().length === 0) {
        return;
      }
      
      const messageTime = message.time || Date.now();
      const messageDate = new Date(messageTime);

      const isValidDate = messageDate.getFullYear() > 1971;
      const messageLocaleDateString = isValidDate
        ? messageDate.toLocaleDateString()
        : now.toLocaleDateString();

      if (messageLocaleDateString !== lastDate && isValidDate) {
        result.push(
          <div key={`date-${messageLocaleDateString}`} className="date-divider">
            {messageLocaleDateString}
          </div>
        );
        lastDate = messageLocaleDateString;
      }

      const renderedMessage = renderMessage(message, index);
      if (renderedMessage) {
        result.push(renderedMessage);
      }
    });

    // Add typing indicator at the end if someone is typing
    if (typingUsers.size > 0) {
      result.push(renderTypingIndicator());
    }

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
        {combinedMessages.length === 0 && typingUsers.size === 0 ? (
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