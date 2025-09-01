# Agora-Trulience Avatar Demo

A simple React application that demonstrates integration between Agora RTC and Trulience Avatar SDKs.

## Features

- Real-time audio streaming with Agora RTC
- 3D avatar visualization with Trulience SDK

## Getting Started

### Prerequisites

- Node.js (v14 or later)
- NPM or Yarn or PNPM

### Installation

1. Clone the repository:

   ```
   git clone https://github.com/yourusername/agora-trulience-demo.git
   cd agora-trulience-demo
   ```

2. Install dependencies:

   ```
   npm install --legacy-peer-deps

   ```

3. Create a `.env` file in the project root:

   ```
   # Agora configuration
   REACT_APP_AGENT_ENDPOINT=rest endpoint for token and start agent
   REACT_APP_AGORA_APP_ID=your_agora_app_id
   # Agora configuration optional - will come from AWS lambda
   REACT_APP_AGORA_CHANNEL_NAME=your_channel_name
   REACT_APP_AGORA_TOKEN=
   REACT_APP_AGORA_UID=

   # Trulience configuration
   REACT_APP_TRULIENCE_AVATAR_ID=your_avatar_id
   REACT_APP_TRULIENCE_SDK_URL=https://trulience.com/sdk/trulience.sdk.js
   REACT_APP_TRULIENCE_AVATAR_TOKEN=your_token
   REACT_APP_TRULIENCE_PROFILE_BASE=https://www.trulience.com/tg-avatar-photos
   ```



### Running the Application

Start the development server:

```
npm run start
```

The application will be available at [http://localhost:3040](http://localhost:3040).

## Usage

1. Open the application in your browser
2. Click the play button to connect to the Agora channel
3. The Trulience avatar will appear and animate based on audio input
4. Use the microphone button in the bottom right to mute/unmute your microphone

## Building for Production

To create a production build:

```
npm run build
```

The build files will be created in the `build` directory.

## Troubleshooting

- If you encounter audio permission issues, ensure your browser has microphone access
- If the avatar doesn't load, check your Trulience configuration and network connection
- For connection issues, verify your Agora App ID and token configuration

## Debug
By default, logs are shown at `warn` level.  
You can change the log level using a query parameter or environment variable.

__Options__
- `?loglevel=debug` → Shows all debug logs  
- `?loglevel=log`   → Normal logs 
- `?loglevel=warn`  → Warnings only (default is `warn`)  
- `?loglevel=error` → Errors only  

## License

[MIT](LICENSE)
