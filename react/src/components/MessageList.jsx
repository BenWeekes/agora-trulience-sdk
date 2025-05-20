const MessageList = ({
  messageEndRef, 
  isEmpty,
  messages, 
  isConnectInitiated
}) => {

  if (isEmpty) {
    return (
      <div className="rtm-messages">
        <div className="rtm-empty-state">
          {isConnectInitiated
            ? "No messages yet. Start the conversation by speaking or typing!"
            : "No messages"}
        </div>
        <div ref={messageEndRef} />
      </div>
    );
  }

  if (messages.length === 0) return null;

  const result = [];
  let lastDate = null;
  const now = new Date();

  messages.forEach((message, index) => {
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
        <div key={`date-${messageLocaleDateString}`}  className="date-divider">{messageLocaleDateString}</div>
      );
      lastDate = messageLocaleDateString;
    }

    // Add the message
    if (message.content && message.content.trim().length > 0) {
      result.push(
        <MessageItem key={message.id || index} message={message} />
      );
    }
  });

  return (
     <div className="rtm-messages">
      {result}
      <div ref={messageEndRef} />
    </div>
  )
}

const MessageItem = ({ message }) => {
  // Skip empty messages
  if (!message.content || message.content.trim().length === 0) {
    return null;
  }
  
  // Get appropriate classes based on message type and status
  let messageClass = `rtm-message ${
    message.isOwn ? "own-message" : "other-message"
  }`;

  // Keep a subtle indicator for in-progress messages
  if (message.isSubtitle && message.status === "in_progress") {
    messageClass += " message-in-progress";
  }

  // Add visual indicator for messages from previous session
  if (message.fromPreviousSession) {
    messageClass += " previous-session";
  }

  // Ensure we have a valid time
  const messageTime = message.time || Date.now();
  const messageDate = new Date(messageTime);
  const isValidDate = messageDate.getFullYear() > 1971;
  const formattedTime = isValidDate
    ? messageDate.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });

  return (
    <div className={messageClass}>
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
      <div className="rtm-message-time">{formattedTime}</div>
    </div>
  );
};

export default MessageList;