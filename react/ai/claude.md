# Agora-Trulience SDK - Codebase Documentation

## Project Overview
A React application integrating Agora RTC (Real-Time Communication) with Trulience Avatar SDK for real-time audio streaming with 3D avatar visualization.

**Tech Stack:**
- React 19.1.0 with Create React App + CRACO
- Agora RTC SDK (v4.23.3) for real-time audio
- Agora RTM (v2.2.2) for real-time messaging
- Trulience React SDK (v1.0.96) for 3D avatars
- PM2 for production deployment

## Project Structure
```
react/
├── src/
│   ├── App.js              # Main application component
│   ├── components/         # React components
│   │   ├── AvatarView.js      # 3D avatar rendering
│   │   ├── ConnectScreen.jsx  # Connection interface
│   │   ├── ControlButtons.js  # Audio/video controls
│   │   ├── IconButtons.js     # UI action buttons
│   │   └── RtmChatPanel.js    # Real-time chat
│   ├── hooks/              # Custom React hooks
│   ├── utils/              # Utility functions
│   └── skins/              # Avatar appearance assets
├── public/                 # Static assets
└── ai/                     # AI documentation (this folder)
```

## Key Features
- Real-time audio streaming via Agora RTC
- 3D avatar visualization with Trulience SDK
- Real-time messaging (RTM) chat functionality
- Microphone controls (mute/unmute)
- Speaker controls
- Connection state management

## Environment Variables
- `REACT_APP_AGENT_ENDPOINT` - REST endpoint for tokens
- `REACT_APP_AGORA_APP_ID` - Agora application ID
- `REACT_APP_TRULIENCE_AVATAR_ID` - Avatar identifier
- `REACT_APP_TRULIENCE_SDK_URL` - SDK source URL
- `REACT_APP_TRULIENCE_AVATAR_TOKEN` - Authentication token

## Scripts
- `npm start` - Development server (port 3040)
- `npm run build` - Production build
- `npm run prod` - Build + PM2 production start
- `npm test` - Run tests

## Recent Changes
- Added speaker button functionality
- Fixed black screen on load issue
- Applied no-cache policy for index.html
- Connected audio agent after avatar loads
- Fixed keyboard awareness avatar positioning

## Development Notes
- Uses CRACO for build customization
- PM2 ecosystem configuration for production
- Debug logging available via query parameters (?loglevel=debug)
- Requires legacy-peer-deps for npm install

---
*Last updated: 2025-09-26*