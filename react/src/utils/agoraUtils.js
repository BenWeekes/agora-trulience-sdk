/**
 * Generate a random 8-character string for channel name
 * 
 * @returns {string} Random 8-character string
 */
export const generateRandomChannelName = () => {
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 8; i++) {
    result += characters.charAt(
      Math.floor(Math.random() * characters.length)
    );
  }
  return result;
};

/**
 * Get parameters from URL query string
 * 
 * @returns {Object} Object containing URL parameters
 */
export const getParamsFromUrl = () => {
  if (typeof window !== "undefined") {
    const urlParams = new URLSearchParams(window.location.search);
    const channelParam = urlParams.get("channel");
    const avatarIdParam = urlParams.get("avatarId");
    const voiceIdParam = urlParams.get("voice_id");
    const promptParam = urlParams.get("prompt");
    const greetingParam = urlParams.get("greeting");

    // Generate random channel name if param is 'random'
    let channelName = process.env.REACT_APP_AGORA_CHANNEL_NAME;
    if (channelParam) {
      if (channelParam === "random") {
        channelName = generateRandomChannelName();
        console.log(`Generated random channel name: ${channelName}`);
      } else {
        channelName = channelParam;
      }
    }

    // Log when avatarId is overridden from URL
    if (avatarIdParam) {
      console.log(`Using avatarId from URL: ${avatarIdParam}`);
    }

    // Log when voice_id is provided
    if (voiceIdParam) {
      console.log(`Using voice_id from URL: ${voiceIdParam}`);
    }

    // Log when prompt is provided
    if (promptParam) {
      console.log(`Using custom prompt from URL`);
    }

    // Log when greeting is provided
    if (greetingParam) {
      console.log(`Using custom greeting from URL`);
    }

    return {
      channelName: generateRandomChannelName(),
      // channelName,
      avatarId: avatarIdParam || process.env.REACT_APP_TRULIENCE_AVATAR_ID,
      voiceId: voiceIdParam || null,
      prompt: promptParam || null,
      greeting: greetingParam || null,
    };
  }
  return {
    channelName: generateRandomChannelName(),
    // process.env.REACT_APP_AGORA_CHANNEL_NAME,
    avatarId: process.env.REACT_APP_TRULIENCE_AVATAR_ID,
    voiceId: null,
    prompt: null,
    greeting: null,
  };
};
