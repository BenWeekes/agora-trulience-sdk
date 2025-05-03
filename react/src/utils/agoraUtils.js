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
    result += characters.charAt(Math.floor(Math.random() * characters.length));
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
    const profileParam = urlParams.get("profile");

    // Log when parameters are overridden from URL
    if (channelParam) {
      console.log(`Using channelName from URL: ${channelParam}`);
    }

    if (avatarIdParam) {
      console.log(`Using avatarId from URL: ${avatarIdParam}`);
    }

    if (voiceIdParam) {
      console.log(`Using voice_id from URL: ${voiceIdParam}`);
    }

    if (promptParam) {
      console.log(`Using custom prompt from URL`);
    }

    if (greetingParam) {
      console.log(`Using custom greeting from URL`);
    }

    if (profileParam) {
      console.log(`Using custom profile from URL`);
    }
    return {
      channelName: channelParam || process.env.REACT_APP_AGORA_CHANNEL_NAME,
      avatarId: avatarIdParam || process.env.REACT_APP_TRULIENCE_AVATAR_ID,
      voice_id: voiceIdParam || null, // Changed from voiceId to voice_id for consistency
      prompt: promptParam || null,
      greeting: greetingParam || null,
      profile: profileParam || null,
    };
  }
  return {
    channelName: process.env.REACT_APP_AGORA_CHANNEL_NAME,
    avatarId: process.env.REACT_APP_TRULIENCE_AVATAR_ID,
    voice_id: null, // Changed from voiceId to voice_id for consistency
    prompt: null,
    greeting: null,
    profile: null,
  };
};