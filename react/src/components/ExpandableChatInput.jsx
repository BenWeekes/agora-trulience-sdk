import { useRef, useEffect } from "react";

export default function ExpandableChatInput({
  rtmInputText = '',
  setRtmInputText = () => {},
  handleSendMessage = () => {},
  disabled,
  isKeyboardVisible,
  setIsKeyboardVisible,
  isPureChatMode = false
}) {
  const inputRef = useRef(null);
  const containerRef = useRef(null);

  // Sync external text to contenteditable div
  useEffect(() => {
    if (inputRef.current && inputRef.current.innerText !== rtmInputText) {
      inputRef.current.innerHTML = rtmInputText;
    }
  }, [rtmInputText]);

  const isIOS =
    /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

  useEffect(() => {
    if (isIOS) {
      const handleFocus = () => {
        inputRef.current.classList.add("input--focused");
        setIsKeyboardVisible(true);
      };
      const handleBlur = () => {
        setIsKeyboardVisible(false);
        inputRef.current.classList.remove("input--focused");
      };

      // Listen for focus and blur events on the document
      document.addEventListener("focusin", handleFocus);
      document.addEventListener("focusout", handleBlur);

      return () => {
        document.removeEventListener("focusin", handleFocus);
        document.removeEventListener("focusout", handleBlur);
      };
    }
  }, [isIOS, setIsKeyboardVisible]);


  useEffect(() => {
    // Focus the textarea if element is attached to DOM and not currently focused
    if (inputRef.current && document.activeElement !== inputRef.current) {
      if (isKeyboardVisible) {
        inputRef.current.focus();
      } else {
        inputRef.current.blur();
      }
    }
  }, [isKeyboardVisible]);


  const handleInput = (e) => {
    const text = e.target.innerText.trim();
    setRtmInputText(text);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const text = inputRef.current?.innerText.trim();
      if (text && !disabled) {
        handleSendMessage();
        setRtmInputText("");
        inputRef.current.innerHTML = ""; // Clear input
      }
    }
  };

  const getPlaceholderText = () => {
    if (disabled) {
      return isPureChatMode ? "Connecting to chat..." : "Connect to start chatting...";
    }
    return "Type a message...";
  };

  return (
    <div className="rtm-input-container" ref={containerRef}>
      <div className="rtm-input-wrapper">
        <div
          ref={inputRef}
          className={`rtm-input ${(disabled) ? 'disabled' : ''}`}
          contentEditable={!disabled}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          role="textbox"
          aria-label="Chat input"
          suppressContentEditableWarning={true}
        />
        {!rtmInputText.replace(/\n/g, '') && (
          <span className="rtm-placeholder">
            {getPlaceholderText()}
          </span>
        )}
      </div>
      <button
        className={`rtm-send-button ${(disabled || !rtmInputText.trim()) ? 'disabled' : ''}`}
        onClick={handleSendMessage}
        disabled={disabled || !rtmInputText.trim()}
        aria-label="Send message"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" stroke="currentColor" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="22" y1="2" x2="11" y2="13"></line>
          <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
        </svg>
      </button>
    </div>
  );
}