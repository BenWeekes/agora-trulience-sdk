# Overview

This repo includes example code in `react/` and `ios/` that demonstrates how the Agora SDK and the Trulience SDK can be used together and embedded in a native mobile application.

# Event Passing

The native app code and the React web app are both configured to dispatch and listen for certain events to communicate across the webview boundary. This allows the native application to 'react' to events happening in the web app, and vice versa.

## Events

The following table describes the events handled in this communication setup, detailing the direction of each message, along with any parameters involved. Events are prefixed with the relevant SDK name where appropriate.

| Event Name             | Direction      | Description                                                                              | Parameters                                          |
| ---------------------- | -------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------- |
| `trlAuthSuccess`       | React -> Swift | Indicates successful authentication.                                                     | Auth success message                                |
| `trlAuthFail`          | React -> Swift | Indicates failed authentication.                                                         | Auth fail message                                   |
| `trlWebsocketConnect`  | React -> Swift | Triggered when WebSocket connects.                                                       | Websocket connect details                           |
| `trlWebsocketClose`    | React -> Swift | Triggered when WebSocket closes.                                                         | Websocket disconnect details                        |
| `trlWebsocketMessage`  | React -> Swift | Triggered for WebSocket messages.                                                        | Websocket message                                   |
| `trlLoadProgress`      | React -> Swift | Updates on load progress.                                                                | `{progress: number}`                                |
| `trlMicUpdate`         | React -> Swift | Updates related to microphone status.                                                    | None                                                |
| `trlMicAccess`         | React -> Swift | Triggered on microphone access attempts.                                                 | None                                                |
| `trlSpeakerUpdate`     | React -> Swift | Updates related to speaker status.                                                       | None                                                |
| `trlChat`              | React -> Swift | Triggered during chat events.                                                            | None                                                |
| `agoraUserPublished`   | React -> Swift | Triggered when a remote user publishes a media stream (audio/video) to the channel.      | `{user, mediaType}`                                 |
| `agoraUserUnpublished` | React -> Swift | Triggered when a remote user un-publishes a media stream (audio/video) from the channel. | `{user, mediaType}`                                 |
| `agoraUserJoined`      | React -> Swift | Indicates that an Agora user has joined a channel.                                       | None                                                |
| `agoraUserLeft`        | React -> Swift | Indicates that an Agora user has left a channel.                                         | None                                                |
| `agoraDetailsUpdated`  | Swift -> React | Used to send Agora connection details to the web app.                                    | `{appId: string, channelName: string, uid: string}` |

## Usage

### React

In the React application, event are listened to using the `NativeBridge` class:

- **Subscribe to Events:**

  First, add the event to the `NativeBridge` class:

  ```javascript
  export class NativeBridge {
    /*
      ...
      */
    agoraDetailsUpdated({ appId, channelName, uid }) {
      this.emit("agoraDetailsUpdated", { appId, channelName, uid });
    }
  }
  ```

  Then register a callback for the event inside of your web app's application code.

  ```javascript
  nativeBridge.on("agoraDetailsUpdated", ({ appId, channelName, uid }) => {
    // Handle event
  });
  ```

- **Unsubscribe from Events:**

  ```javascript
  nativeBridge.off("agoraDetailsUpdated", yourHandlerFunction);
  ```

- **Emit Events:**
  Make sure to call native functions using `callNativeAppFunction` to trigger events in the Swift layer.

### Swift

- **Subscribe to Events**
  First an event is registered in the constructor in `Webview.swift`:

  ```swift
  webView.configuration.userContentController.add(coordinator, name: "trlAuthSuccess")

  ```

  Then the event is handled inside of the `Coordinator`'s `userContentController` overload.

  ```swift
  class Coordinator: NSObject, WKScriptMessageHandler, WKUIDelegate, WKNavigationDelegate {
      /*
      ...
      */
      func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
              if message.name == "trlAuthSuccess" {
                  // handle event
              }

              /*
              ...
              */
      }
  }
  ```

- **Emit events**

  To emit an event you can use the `callJavaScriptFunction` helper and pass the `functionName` along with any params. The `functionName` has to match one of the events defined in the web app's `NativeBridge` class.

  ```swift
  func sendAgoraDetailsToReact(connectionInfo: ConnectionInfo) {
      let arg: [String: Any] = [
          "appId": connectionInfo.appId,
          "channelName": connectionInfo.channelName,
          "uid": connectionInfo.uid
      ]
      callJavaScriptFunction(functionName: "agoraDetailsUpdated", parameter: arg)
  }
  ```

### Android

- **Load the Web App Build**  
  We’ve added a Gradle task that copies the React build into the Android project before building. You can check the copy script in `app/build.gradle.kts`.  
  **Note:** You need to manually build the React app first by running `pnpm build` inside the `react` folder.

- **Subscribe to Events**  
  Events from the WebView are handled inside the `Coordinator` class via the `userContentController` function.

  ```kotlin
  class Coordinator(private val webView: WebView) {

      fun userContentController(eventName: String, body: Map<String, Any>?) {
          when (eventName) {
              "trlAuthSuccess" -> {
                  // Handle authentication success event
              }
              // ...
          }
      }
  }
  ```

- **Emit Events**  
  To emit events to the web app, use the `callJavaScriptFunction` helper in the `Coordinator`. Pass the `functionName` and any required parameters.  
  The `functionName` must match one of the functions defined in the web app’s `NativeBridge` class.

  ```kotlin
  fun sendAgoraDetailsToReact(connectionInfo: ConnectionInfo) {
      val json = Gson().toJson(connectionInfo)
      callJavaScriptFunction("agoraDetailsUpdated", json)
  }
  ```
  