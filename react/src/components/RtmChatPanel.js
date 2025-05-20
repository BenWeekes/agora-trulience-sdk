import { useState, useRef, useEffect } from "react";
import ChatInput from "./ChatInput";
import MessageList from "./MessageList";
import { useRtmMessageHandler } from "../hooks/useRtmMessageHandler";

/**
 * Component for RTM chat interface with WhatsApp-like styling
 */
export const RtmChatPanel = ({
  rtmClient,
  agoraConfig,
  agoraClient,
  isConnectInitiated,
  processMessage,
  isFullscreen,
  registerDirectSend
}) => {
  const rtmMessageEndRef = useRef(null);
  const [rtmInputText, setRtmInputText] = useState("");
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  const {
    combinedMessages,
    directSendMessage,
  } = useRtmMessageHandler({
    agoraClient,
    agoraConfig,
    isConnectInitiated,
    processMessage,
    registerDirectSend,
    rtmClient
  })

  // Effect to handle scrolling when messages change
  useEffect(() => {
    // Scroll to bottom when new messages arrive
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

    // Actually send the message
    await directSendMessage(messageToSend);
  };


  return (
    <div className={`rtm-container  ${isFullscreen ? "hidden": ""}`} >
      <MessageList
        messages={combinedMessages}
        isConnectInitiated={isConnectInitiated}
        isEmpty={combinedMessages.length === 0}
        messageEndRef={rtmMessageEndRef}
      />
      <ChatInput 
        rtmInputText={rtmInputText}
        setRtmInputText={setRtmInputText}
        handleSendMessage={handleSendMessage}
        disabled={!isConnectInitiated}
        isKeyboardVisible={isKeyboardVisible} 
        setIsKeyboardVisible={setIsKeyboardVisible}
      />
    </div>
  );
}
