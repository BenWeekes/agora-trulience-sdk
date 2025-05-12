export const initialConnectionState = {
  app: {
    loading: true,
    loaded: false,
    connected: false
  },
  avatar: {
    loading: true,
    loaded: false,
    wsConnecting: false,
    wsConnected: false,
  },
  agent: {
    connecting: false,
    connected: false,
  },
  agora: {
    connecting: false,
    connected: false,
  },
  rtm: {
    connecting: false,
    connected: false,
  },
  error: null,
  isConnected: false,
};

// Enum-like object for action types
export const ConnectionState = {
  APP_LOADED: 'APP_LOADED',
  APP_CONNECTED: "APP_CONNECTED",

  AVATAR_LOADING: 'AVATAR_LOADING',
  AVATAR_LOADED: 'AVATAR_LOADED',
  
  AVATAR_WS_CONNECTING: 'AVATAR_WS_CONNECTING',
  AVATAR_WS_CONNECTED: 'AVATAR_WS_CONNECTED',
  AVATAR_WS_DISCONNECT: 'AVATAR_DISCONNECT',
  
  AGENT_CONNECTING: 'AGENT_CONNECTING',
  AGENT_CONNECTED: 'AGENT_CONNECTED',
  AGENT_DISCONNECT: 'AGENT_DISCONNECT',
  
  AGORA_CONNECTING: 'AGORA_CONNECTING',
  AGORA_CONNECTED: 'AGORA_CONNECTED',
  AGORA_DISCONNECT: 'AGORA_DISCONNECT',
  
  RTM_CONNECTING: 'RTM_CONNECTING',
  RTM_CONNECTED: 'RTM_CONNECTED',
  RTM_DISCONNECT: 'RTM_DISCONNECT',
  
  SET_ERROR: 'SET_ERROR',
  CLEAR_ERROR: 'CLEAR_ERROR',
  RESET_CONNECTION_STATE: 'RESET_CONNECTION_STATE',
  DISCONNECT: "DISCONNECT"
  
  // Disconnect actions for each type
};

// Helper function to compute full connection status
function isFullyConnected(state) {
  return (
    state.avatar.wsConnected &&
    state.agent.connected &&
    state.agora.connected
  );
}

// Reducer function
/**
 * 
 * @param {typeof initialConnectionState} state 
 * @param {*} action 
 * @returns 
 */
export function connectionReducer(state, action) {
  switch (action) {

    case ConnectionState.APP_LOADED:
      return {
        ...state,
        app: { ...state.app, loading: false, loaded: true },
      };

    case ConnectionState.APP_CONNECTED:
      return {
        ...state,
        app: { ...state.app, connected: true },
      };

    case ConnectionState.AVATAR_LOADING:
      return {
        ...state,
        avatar: { ...state.avatar, loading: true, loaded: false },
      };

    case ConnectionState.AVATAR_LOADED:
      return {
        ...state,
        avatar: { ...state.avatar, loading: false, loaded: true },
      };

    case ConnectionState.AVATAR_WS_CONNECTING:
      return {
        ...state,
        avatar: { ...state.avatar, wsConnecting: true },
      };

    case ConnectionState.AVATAR_WS_CONNECTED: {
      const newState = {
        ...state,
        avatar: { ...state.avatar, wsConnecting: false, wsConnected: true },
      };
      return {
        ...newState,
        isConnected: isFullyConnected(newState),
      };
    }

    case ConnectionState.AVATAR_WS_DISCONNECT:
      return {
        ...state,
        avatar: { ...state.avatar, wsConnected: false, wsConnecting: false },
        isConnected: false,
      };

    // Agent
    case ConnectionState.AGENT_CONNECTING:
      return { ...state, agent: { connecting: true, connected: false } };

    case ConnectionState.AGENT_CONNECTED: {
      const newState = {
        ...state,
        agent: { connecting: false, connected: true },
      };
      return {
        ...newState,
        isConnected: isFullyConnected(newState),
      };
    }

    case ConnectionState.AGENT_DISCONNECT:
      return {
        ...state,
        agent: { connecting: false, connected: false },
        isConnected: false,
      };

    // Agora
    case ConnectionState.AGORA_CONNECTING:
      return { ...state, agora: { connecting: true, connected: false } };

    case ConnectionState.AGORA_CONNECTED: {
      const newState = {
        ...state,
        agora: { connecting: false, connected: true },
      };
      return {
        ...newState,
        isConnected: isFullyConnected(newState),
      };
    }
    case ConnectionState.AGORA_DISCONNECT:
      return {
        ...state,
        agora: { connecting: false, connected: false },
        isConnected: false,
      };

    // RTM
    case ConnectionState.RTM_CONNECTING:
      return { ...state, rtm: { connecting: true, connected: false } };

    case ConnectionState.RTM_CONNECTED: {
      const newState = {
        ...state,
        rtm: { connecting: false, connected: true },
      };
      return {
        ...newState,
        isConnected: isFullyConnected(newState),
      };
    }
    
    case ConnectionState.RTM_DISCONNECT:
      return {
        ...state,
        rtm: { connecting: false, connected: false },
        isConnected: false,
      };

    case ConnectionState.SET_ERROR:
      return { ...state, error: action.payload };

    case ConnectionState.CLEAR_ERROR:
      return { ...state, error: null };

    case ConnectionState.DISCONNECT:
      // We are not currently resetting avatar state, as we are keeping it loaded.
      return { 
        ...state,
        app: { ...state.app, connected: false },
        rtm: { connecting: false, connected: false },
        agent: { connecting: false, connected: false },
        agora: { connecting: false, connected: false },
        isConnected: false,
      };

    case ConnectionState.RESET_STATE:
      return { ...initialConnectionState };

    default:
      return state;
  }
}
