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
    
    // Subscribe to the channel
    const subscribeResult = await rtm.subscribe(channelName);
    console.log("[RTM] Subscribe Message Channel success:", subscribeResult);
    
    // Add message event listener
    rtm.addEventListener("message", messageHandler);
    
    return rtm;
  } catch (error) {
    console.error("Failed to initialize RTM client:", error);
    return null;
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
  const { message, messageType, timestamp, publisher } = event;
  
  try {
    if (messageType === "STRING") {
      const parsedMsg = JSON.parse(message);
      
      // Handle image messages
      if (parsedMsg.img) {
        setRtmMessages(prev => [...prev, {
          type: 'agent',
          time: timestamp,
          content: parsedMsg.img,
          contentType: 'image',
          userId: publisher,
          isOwn: false
        }]);
        return;
      }
      
      // Handle text messages
      if (parsedMsg.text !== undefined) {
        setRtmMessages(prev => [...prev, {
          type: publisher === String(currentUserId) ? 'user' : 'agent',
          time: timestamp || Date.now(),
          content: parsedMsg.text,
          contentType: 'text',
          userId: publisher,
          isOwn: publisher === String(currentUserId)
        }]);
      }
    }
    
    // Handle binary messages
    if (messageType === "BINARY") {
      const decoder = new TextDecoder("utf-8");
      const decodedMessage = decoder.decode(message);
      const parsedMsg = JSON.parse(decodedMessage);
      if (parsedMsg.text !== undefined) {
        setRtmMessages(prev => [...prev, {
          type: publisher === String(currentUserId) ? 'user' : 'agent',
          time: timestamp || Date.now(),
          content: parsedMsg.text,
          contentType: 'text',
          userId: publisher,
          isOwn: publisher === String(currentUserId)
        }]);
      }
    }
  } catch (error) {
    console.error("Error processing RTM message:", error);
  }
};

/**
 * Send a text message via RTM to a specific peer (agent)
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
      stream_id: String(uid),
    };
    
    // Send a peer message to the agent (with UID "agent")
    await rtmClient.sendMessageToPeer("agent", JSON.stringify(msgObject), {
      enableOfflineMessaging: true,
      enableHistoricalMessaging: true,
    });
    
    return true;
  } catch (error) {
    console.error("Failed to send RTM message:", error);
    return false;
  }
};