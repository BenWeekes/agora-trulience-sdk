import AgoraRTM from "agora-rtm";

/**
 * Initialize and set up an RTM client
 * 
 * @param {string} appId - Agora App ID
 * @param {number|string} uid - User ID
 * @param {string} token - Authentication token
 * @param {string} channelName - Channel to join
 * @param {Function} messageHandler - Callback for RTM messages
 * @returns {Promise<RTMClient|null>} RTM client instance or null on failure
 */
export const initRtmClient = async (appId, uid, token, channelName, messageHandler) => {
  try {
    // Create RTM client
    const rtm = new AgoraRTM.RTM(appId, String(uid), {
      logLevel: "warn",
    });
    
    // Login to RTM
    await rtm.login({ token });
    
    // Subscribe to the channel with minimal options
    const subscribeResult = await rtm.subscribe(channelName, {
      withMessage: true,
      withPresence: false,
      beQuiet: false,
      withMetadata: false,
      withLock: false,
    });
    console.log("[RTM] Subscribe Message Channel success:", subscribeResult);
    console.error(token,channelName,uid);
    // Store the channel name for later use
    rtm.channel = channelName;
    
    // Add message event listener
    rtm.addEventListener("message", messageHandler);
    
    return rtm;
  } catch (error) {
    console.error("Failed to initialize RTM client:", error);
    return null;
  }
};

/**
 * Send a text message via RTM to the channel
 * 
 * @param {RTMClient} rtmClient - RTM client instance
 * @param {string} text - Message content
 * @param {string|number} uid - User ID
 * @returns {Promise<boolean>} Success status
 */
export const sendRtmMessage = async (rtmClient, text, uid) => {
  if (!rtmClient || !text.trim()) return false;
  
  try {
    const msgObject = {
      is_final: true,
      ts: Date.now(),
      text: text.trim(),
      type: "INPUT_TEXT",
      data_type: "text",
      stream_id: String(uid),
    };
    
    const options = {
      customType: "PlainTxt",
      channelType: "USER",
  };
    // Send message to the channel
    //await rtmClient.publish(rtmClient.channel, JSON.stringify(msgObject));
//    await rtmClient.publish('agent', JSON.stringify(msgObject),options);
await rtmClient.publish('agent', text.trim(),options); // JSON.stringify(msgObject));
    
    return true;
  } catch (error) {
    console.error("Failed to send RTM message:", error);
    return false;
  }
};

/**
 * Handle incoming RTM messages
 * 
 * @param {Object} event - RTM message event
 * @param {string|number} currentUserId - Current user's ID
 * @param {Function} setRtmMessages - State setter for RTM messages
 */
export const handleRtmMessage = (event, currentUserId, setRtmMessages) => {
  try {
    const { message, messageType, timestamp, publisher } = event;
    
    // Log the event for debugging
    console.error("[RTM] Message received:", {
      publisher,
      currentUserId,
      messageType,
      timestamp
    });
    
    if (messageType === "STRING") {
      try {
        const parsedMsg = JSON.parse(message);
        console.log("[RTM] Parsed message:", parsedMsg);
        
        // Determine if the message is from the current user or the agent
        // Messages received from the agent have a different publisher than the current user
        const isFromAgent = publisher !== String(currentUserId);
        
        // Handle image messages
        if (parsedMsg.img) {
          setRtmMessages(prev => [...prev, {
            type: isFromAgent ? 'agent' : 'user',
            time: timestamp || Date.now(),
            content: parsedMsg.img,
            contentType: 'image',
            userId: publisher,
            isOwn: !isFromAgent // User's own messages have isOwn=true
          }]);
          return;
        }
        
        // Handle text messages
        if (parsedMsg.text !== undefined) {
          setRtmMessages(prev => [...prev, {
            type: isFromAgent ? 'agent' : 'user',
            time: timestamp || Date.now(),
            content: parsedMsg.text,
            contentType: 'text',
            userId: publisher,
            isOwn: !isFromAgent // User's own messages have isOwn=true
          }]);
        }
      } catch (parseError) {
        console.error("[RTM] Error parsing message:", parseError);
        // Try to display raw message if parsing fails
        setRtmMessages(prev => [...prev, {
          type: publisher === String(currentUserId) ? 'user' : 'agent',
          time: timestamp || Date.now(),
          content: typeof message === 'string' ? message : 'Unparseable message',
          contentType: 'text',
          userId: publisher,
          isOwn: publisher === String(currentUserId)
        }]);
      }
    }
    
    // Handle binary messages
    if (messageType === "BINARY") {
      try {
        const decoder = new TextDecoder("utf-8");
        const decodedMessage = decoder.decode(message);
        const parsedMsg = JSON.parse(decodedMessage);
        
        // Determine if the message is from the current user or the agent
        const isFromAgent = publisher !== String(currentUserId);
        
        if (parsedMsg.text !== undefined) {
          setRtmMessages(prev => [...prev, {
            type: isFromAgent ? 'agent' : 'user',
            time: timestamp || Date.now(),
            content: parsedMsg.text,
            contentType: 'text',
            userId: publisher,
            isOwn: !isFromAgent // User's own messages have isOwn=true
          }]);
        }
      } catch (parseError) {
        console.error("[RTM] Error parsing binary message:", parseError);
      }
    }
  } catch (error) {
    console.error("Error processing RTM message:", error);
  }
};