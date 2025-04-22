package com.example.agora_trulience_sdk

import android.Manifest
import android.util.Log
import android.webkit.PermissionRequest
import android.webkit.WebView
import androidx.activity.result.ActivityResultLauncher
import com.google.gson.Gson

class Coordinator(private val webView: WebView) {

    private val tag = "Coordinator"

    // Handle messages from JavaScript to native (WebView)
    fun userContentController(eventName: String, body: Map<String, Any>?) {
        Log.d(tag, "onJavascriptMessageReceived - name: $eventName, body: ${body.toString()}")

        when (eventName) {
            "trlAuthSuccess" -> {
                // Handle authentication success event
            }
            "trlAuthFail" -> {
                // Handle authentication failure event
            }
            "trlWebsocketConnect" -> {
                // Handle WebSocket connect event
            }
            "trlWebsocketClose" -> {
                // Handle WebSocket close event
            }
            "trlWebsocketMessage" -> {
                // Handle WebSocket message event
            }
            "trlLoadProgress" -> {
                // Handle load progress event
            }
            "trlMicUpdate" -> {
                // Handle microphone update event
            }
            "trlMicAccess" -> {
                // Handle microphone access event
            }
            "trlSpeakerUpdate" -> {
                // Handle speaker update event
            }
            "trlChat" -> {
                // Handle chat event
            }
            "agoraUserPublished" -> {
                // Handle Agora user published event
            }
            "agoraUserUnpublished" -> {
                // Handle Agora user unpublished event
            }
            "agoraUserJoined" -> {
                // Handle Agora user joined event
            }
            "agoraUserLeft" -> {
                // Handle Agora user left event
            }
            else -> {
                // Handle other events
            }
        }
    }


    fun sendAgoraDetailsToReact(connectionInfo: ConnectionInfo) {
        val json = Gson().toJson(connectionInfo)
        callJavaScriptFunction("agoraDetailsUpdated", json)
    }

    private fun callJavaScriptFunction(functionName: String, jsonString: String) {
        val script = "window.NativeBridge.$functionName($jsonString);"
        Log.d(tag, "Evaluating JS: $script")

        webView.evaluateJavascript(script) { result ->
            Log.d(tag, "Result: $result")
        }
    }

    // Handle media capture permissions for WebView
    fun handleMediaCapturePermission(
        request: PermissionRequest,
        launcher: ActivityResultLauncher<Array<String>>,
        updatePendingRequest: (PermissionRequest?) -> Unit
    ) {
        val permissionsToRequest = mutableListOf<String>()

        if (request.resources.contains(PermissionRequest.RESOURCE_VIDEO_CAPTURE)) {
            permissionsToRequest.add(Manifest.permission.CAMERA)
        }
        if (request.resources.contains(PermissionRequest.RESOURCE_AUDIO_CAPTURE)) {
            permissionsToRequest.add(Manifest.permission.RECORD_AUDIO)
        }

        if (permissionsToRequest.isNotEmpty()) {
            updatePendingRequest(request)
            launcher.launch(permissionsToRequest.toTypedArray())
        } else {
            request.deny()
        }
    }
}