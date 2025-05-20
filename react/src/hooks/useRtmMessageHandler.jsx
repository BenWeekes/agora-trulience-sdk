import { useRef, useEffect, useState, useCallback } from "react";
import { MessageEngine, MessageStatus } from "../utils/messageService";

export const useRtmMessageHandler = ({
  rtmClient,
  agoraConfig,
  isConnectInitiated,
  agoraClient,
  processMessage,
  registerDirectSend
}) => {
  const messageEngineRef = useRef(null);
  const [combinedMessages, setCombinedMessages] = useState([]);
  const [pendingRtmMessages, setPendingRtmMessages] = useState([]);

  // Function to process and update combined messages
  const updateCombinedMessages = useCallback((messageList, pendingMessages) => {
    console.log("## updateCombinedMessages", messageList, pendingMessages)
    const subtitleMessages = [];
    const now = Date.now(); // Current timestamp for fallback

    // Process live subtitles
    messageList.forEach((msg) => {
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
        fromPreviousSession: !isConnectInitiated, // Mark as from previous session if not connected
      });
    });

    // Include all pending RTM messages with valid timestamps
    const typedMessages = pendingMessages.map((msg, index) => {
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

    console.log("## Combined messages count:", allMessages);
    setCombinedMessages(allMessages);
  }, [isConnectInitiated]);

  const directSendMessage = useCallback(async (message, skipHistory = false) => {
    if (!message.trim()) return false;

    try {
      console.log("Direct send using rtmClient:", !!rtmClient, "Skip history:", skipHistory);
      
      // Check if rtmClient is available, and try to send the message
      if (rtmClient) {
        const options = {
          customType: "user.transcription",
          channelType: "USER",
        };
        
        // Send message to the channel using the simplified format
        await rtmClient.publish('agent', message.trim(), options);
        console.log("Message sent successfully via direct send");

        // Only add to pending messages if skipHistory is false
        if (!skipHistory) {
          const newMessage = {
            type: "user",
            time: Date.now(),
            content: message.trim(),
            contentType: "text",
            userId: String(agoraConfig.uid),
            isOwn: true,
          };
          
          setPendingRtmMessages((prev) => {
            const updatedMessages = [...prev, newMessage];
            // If MessageEngine exists, update the combined messages
            if (messageEngineRef.current) {
              updateCombinedMessages(messageEngineRef.current.messageList, updatedMessages);
            }
            return updatedMessages;
          });
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
  }, [rtmClient, agoraConfig.uid, updateCombinedMessages]);

  useEffect(() => {
 // Part 1: Register direct send function when available
    if (registerDirectSend && rtmClient) {
      console.log("Registering direct send function with rtmClient");
      registerDirectSend(directSendMessage);
    }
  }, [directSendMessage, registerDirectSend, rtmClient])


  const onMessageListChange = (messageList) => {
    console.log(`Received ${messageList.length} subtitle messages`);
    // Process messages directly without setting intermediate state
    if (messageList && messageList.length > 0) {
      // Process any commands in final messages
      if (processMessage) {
        messageList.forEach(msg => {
          if (msg.status === MessageStatus.END && msg.text && msg.uid === 0) {
            msg.text = processMessage(msg.text, msg.turn_id || "");
          }
        });
      }
      
      // Process and update combined messages directly
      updateCombinedMessages(messageList, pendingRtmMessages);
    }
  }

  const onMessageListChangeRef = useRef(onMessageListChange)
  onMessageListChangeRef.current = onMessageListChange

  // Initialize MessageEngine for subtitles with message processor
  useEffect(() => {
    if (agoraClient && !messageEngineRef.current && isConnectInitiated) {
      console.log("Initializing MessageEngine with client:", agoraClient);

      // Create MessageEngine instance
      messageEngineRef.current = new MessageEngine(
        agoraClient,
        "auto",
        (messageList) => onMessageListChangeRef.current(messageList)
      );
      console.log("MessageEngine initialized:", messageEngineRef.current);
    }

    // Cleanup on unmount
    return () => {
      if (messageEngineRef.current) {
        messageEngineRef.current.cleanup();
        setPendingRtmMessages([])
      }
    };
  }, [agoraClient, isConnectInitiated]);

  return {
    combinedMessages,
    directSendMessage
  };
};
