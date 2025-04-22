# Agora-Trulience Avatar Demo

A simple React application that demonstrates integration between Agora RTC and Trulience Avatar SDKs.

## Features

- Real-time audio streaming with Agora RTC
- 3D avatar visualization with Trulience SDK

## Getting Started

### Prerequisites

- Node.js (v14 or later)
- NPM or Yarn

### Installation

1. Clone the repository:

   ```
   git clone https://github.com/yourusername/agora-trulience-demo.git
   cd agora-trulience-demo
   ```

2. Install dependencies:

   ```
   npm install
   ```

3. Create a `.env` file in the project root:

   ```
   # Agora configuration
   REACT_APP_AGENT_ENDPOINT=rest endpoint for token and start agent
   REACT_APP_AGORA_APP_ID=your_agora_app_id
   REACT_APP_AGORA_CHANNEL_NAME=your_channel_name
   REACT_APP_AGORA_TOKEN=
   REACT_APP_AGORA_UID=111

   # Trulience configuration
   REACT_APP_TRULIENCE_AVATAR_ID=your_avatar_id
   REACT_APP_TRULIENCE_SDK_URL=https://digitalhuman.uk/sdk/trulience.sdk.js
   REACT_APP_TRULIENCE_AVATAR_TOKEN=your_token
   REACT_BUNDLED_URLS=[""]
   ```

### File bundling

You can place external URLs in the `.env` file to bundle them in the final `build/` output. This can be used to reduce loading times inside of the app. The value of `REACT_BUNDLED_URLS` should be a JSON string array. Running the script with `npm run fetch-bundled-files` will download the files to `src/BUNDLED` and generate code in `src/BUNDLED/index.js` to return the bundled files when the fetch override in `src/overrideFetch.js` requests them.

### Running the Application

Run `npm run fetch-bundled-files` to generate `src/BUNDLED/index.js`, this is necessary even if `REACT_BUNDLED_URLS`'s value is `[""]` (empty array) as the file needs to exist.

Start the development server:

```
npm start
```

The application will be available at [http://localhost:3000](http://localhost:3000).

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

## License

[MIT](LICENSE)
