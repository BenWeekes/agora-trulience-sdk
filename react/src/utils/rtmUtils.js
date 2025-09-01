import AgoraRTM from "agora-rtm";
import logger from "./logger";

/**
 * Initialize and set up an RTM client
 * 
 * @param {string} appId - Agora App ID
 * @param {number|string} uid - User ID
 * @param {string} token - Authentication token
 * @param {string} loginChannelName - Channel to use for login (always derivedChannelName)
 * @param {Function} messageHandler - Callback for RTM messages
 * @param {Function} presenceHandler - Callback for RTM presence events
 * @returns {Promise<RTMClient|null>} RTM client instance or null on failure
 */
export const initRtmClient = async (appId, uid, token, loginChannelName, messageHandler, presenceHandler = null) => {
  try {
    // Create RTM client - always use derivedChannelName for login
    logger.log("RTM Login:", {
      uid: uid,
      loginChannelName: loginChannelName,
      loginString: String(uid + "-" + loginChannelName)
    });
    
    const rtm = new AgoraRTM.RTM(appId, String(uid + "-" + loginChannelName), {
      logLevel: "warn",
    });
    
    // Login to RTM
    await rtm.login({ token });
    
    // Subscribe to the login channel with presence enabled
    const subscribeResult = await rtm.subscribe(loginChannelName, {
      withMessage: true,
      withPresence: true, // Enable presence messages
      beQuiet: false,
      withMetadata: false,
      withLock: false,
    });
    logger.log("[RTM] Subscribe Message Channel success:", subscribeResult);
    
    // Store the login channel name for later use
    rtm.loginChannel = loginChannelName;
    
    // Add message event listener
    rtm.addEventListener("message", messageHandler);
    
    // Add presence event listener if provided
    if (presenceHandler) {
      rtm.addEventListener("presence", presenceHandler);
      logger.log("[RTM] Presence event listener added");
    }
    
    return rtm;
  } catch (error) {
    logger.error("Failed to initialize RTM client:", error);
    return null;
  }
};

/**
 * Handle incoming RTM messages
 * 
 * @param {Object} event - RTM message event
 * @param {string|number} currentUserId - Current user's ID
 * @param {Function} setRtmMessages - State setter for RTM messages
 * @param {Function} messageProcessor - Optional function to process messages
 * @param {Function} setTypingUsers - Optional function to set typing indicators
 */
export const handleRtmMessage = (event, currentUserId, setRtmMessages, messageProcessor, setTypingUsers = null) => {
  try {
    const { message, messageType, timestamp, publisher } = event;
    
    logger.debug("BBB [RTM] Message received (handleRtmMessage):", {
      publisher,
      currentUserId,
      messageType,
      timestamp,
      message: typeof message === 'string' ? message : '[binary data]'
    });
    
    // Determine if the message is from the current user or the agent
    const isFromAgent = publisher !== String(currentUserId);
    
    // Handle string messages (most common)
    if (messageType === "STRING") {
      // First try to parse as JSON
      try {
        const parsedMsg = JSON.parse(message);
        
        // Handle typing indicators
        if (parsedMsg.type === "typing_start" && setTypingUsers) {
          if (isFromAgent) {
            setTypingUsers(prev => new Set([...prev, publisher]));
            
            // Auto-clear typing after 15 seconds
            setTimeout(() => {
              setTypingUsers(prev => {
                const newSet = new Set(prev);
                newSet.delete(publisher);
                return newSet;
              });
            }, 15000);
          }
          return; // Don't display typing indicators as messages
        }
        
        // Handle image messages
        if (parsedMsg.img) {
          // Clear typing indicator when real message arrives
          if (setTypingUsers && isFromAgent) {
            setTypingUsers(prev => {
              const newSet = new Set(prev);
              newSet.delete(publisher);
              return newSet;
            });
          }
          
          setRtmMessages(prev => [...prev, {
            type: isFromAgent ? 'agent' : 'user',
            time: timestamp || Date.now(),
            content: parsedMsg.img,
            contentType: 'image',
            userId: publisher,
            isOwn: !isFromAgent
          }]);
          return;
        }
        
        // Handle text messages from JSON
        if (parsedMsg.text !== undefined) {
          // Clear typing indicator when real message arrives
          if (setTypingUsers && isFromAgent) {
            setTypingUsers(prev => {
              const newSet = new Set(prev);
              newSet.delete(publisher);
              return newSet;
            });
          }
          
          // Process message if processor is provided
          let processedText = parsedMsg.text;
          if (messageProcessor && isFromAgent) {
            processedText = messageProcessor(processedText, parsedMsg.turn_id || "");
            
            // If the message was entirely a command, don't display it
            if (processedText === "") {
              return;
            }
          }
          
          setRtmMessages(prev => [...prev, {
            type: isFromAgent ? 'agent' : 'user',
            time: timestamp || Date.now(),
            content: processedText,
            contentType: 'text',
            userId: publisher,
            isOwn: !isFromAgent,
            turn_id: parsedMsg.turn_id
          }]);
          return;
        }
        
        // If we got here, it's JSON but without recognized fields
        // Clear typing indicator for any real message
        if (setTypingUsers && isFromAgent) {
          setTypingUsers(prev => {
            const newSet = new Set(prev);
            newSet.delete(publisher);
            return newSet;
          });
        }
        
        setRtmMessages(prev => [...prev, {
          type: isFromAgent ? 'agent' : 'user',
          time: timestamp || Date.now(),
          content: message, // Use the original string
          contentType: 'text',
          userId: publisher,
          isOwn: !isFromAgent
        }]);
        
      } catch (parseError) {
        // Not valid JSON, treat as plain text
        // Clear typing indicator when real message arrives
        if (setTypingUsers && isFromAgent) {
          setTypingUsers(prev => {
            const newSet = new Set(prev);
            newSet.delete(publisher);
            return newSet;
          });
        }
        
        // Process message if processor is provided
        let processedText = message;
        if (messageProcessor && isFromAgent) {
          processedText = messageProcessor(processedText);
          
          // If the message was entirely a command, don't display it
          if (processedText === "") {
            return;
          }
        }
        
        setRtmMessages(prev => [...prev, {
          type: isFromAgent ? 'agent' : 'user',
          time: timestamp || Date.now(),
          content: processedText,
          contentType: 'text',
          userId: publisher,
          isOwn: !isFromAgent
        }]);
      }
      return;
    }
    
    // Handle binary messages
    if (messageType === "BINARY") {
      try {
        const decoder = new TextDecoder("utf-8");
        const decodedMessage = decoder.decode(message);
        
        // Clear typing indicator when real message arrives
        if (setTypingUsers && isFromAgent) {
          setTypingUsers(prev => {
            const newSet = new Set(prev);
            newSet.delete(publisher);
            return newSet;
          });
        }
        
        // Process message if processor is provided
        let processedText = decodedMessage;
        if (messageProcessor && isFromAgent) {
          processedText = messageProcessor(processedText);
          
          // If the message was entirely a command, don't display it
          if (processedText === "") {
            return;
          }
        }
        
        // Try to parse as JSON
        try {
          const parsedMsg = JSON.parse(decodedMessage);
          
          if (parsedMsg.text !== undefined) {
            // Process message if processor is provided
            let processedText = parsedMsg.text;
            if (messageProcessor && isFromAgent) {
              processedText = messageProcessor(processedText, parsedMsg.turn_id || "");
              
              // If the message was entirely a command, don't display it
              if (processedText === "") {
                return;
              }
            }
            
            setRtmMessages(prev => [...prev, {
              type: isFromAgent ? 'agent' : 'user',
              time: timestamp || Date.now(),
              content: processedText,
              contentType: 'text',
              userId: publisher,
              isOwn: !isFromAgent,
              turn_id: parsedMsg.turn_id
            }]);
            return;
          }
        } catch {
          // Not valid JSON, use the decoded message directly
        }
        
        // Use the decoded message as plain text
        setRtmMessages(prev => [...prev, {
          type: isFromAgent ? 'agent' : 'user',
          time: timestamp || Date.now(),
          content: processedText,
          contentType: 'text',
          userId: publisher,
          isOwn: !isFromAgent
        }]);
      } catch (error) {
        logger.error("[RTM] Error processing binary message:", error);
      }
    }
  } catch (error) {
    logger.error("Error processing RTM message:", error);
  }
};

/**
 * Handle RTM presence events
 * 
 * @param {Object} event - RTM presence event
 */
export const handleRtmPresence = (event) => {
  try {
    const { eventType, publisher, channelName, timestamp, stateChanged } = event;
    
    logger.log("[RTM] Presence event received:", {
      eventType,
      publisher,
      channelName,
      timestamp,
      stateChanged
    });
    
    // Handle different presence event types
    switch (eventType) {
      case "REMOTE_JOIN":
        logger.log(`[RTM] 👋 User ${publisher} joined channel ${channelName}`);
        break;
        
      case "REMOTE_LEAVE":
        logger.log(`[RTM] 👋 User ${publisher} left channel ${channelName}`);
        break;
        
      case "REMOTE_TIMEOUT":
        logger.log(`[RTM] ⏰ User ${publisher} timed out from channel ${channelName}`);
        break;
        
      case "SNAPSHOT":
        logger.log(`[RTM] 📸 Channel snapshot for ${channelName}`);
        break;
        
      default:
        logger.log(`[RTM] 🔄 Unknown presence event type: ${eventType}`);
    }
    
    // Handle state changes (agent status updates)
    if (stateChanged?.state && stateChanged?.turn_id) {
      logger.log(`[RTM] 🔄 Agent state changed:`, {
        state: stateChanged.state,
        turn_id: stateChanged.turn_id,
        timestamp,
        publisher
      });
      
      // You can add custom logic here to handle agent state changes
      // For example, updating UI to show agent is thinking, speaking, etc.
    }
    
  } catch (error) {
    logger.error("[RTM] Error processing presence event:", error);
  }
};