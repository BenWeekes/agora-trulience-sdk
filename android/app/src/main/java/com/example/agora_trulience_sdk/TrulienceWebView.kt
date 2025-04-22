package com.example.agora_trulience_sdk

import android.annotation.SuppressLint
import android.os.Bundle
import android.view.ViewGroup
import android.webkit.JavascriptInterface
import android.webkit.PermissionRequest
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.viewinterop.AndroidView
import androidx.navigation.NavController
import com.google.gson.Gson
import com.google.gson.JsonSyntaxException

val gson = Gson()

// Generic function to parse JSON string into a Map
fun parseJsonToMap(json: String?): Map<String, Any>? {
    if (json.isNullOrBlank()) return null

    return try {
        gson.fromJson(json, Map::class.java) as? Map<String, Any>
    } catch (e: JsonSyntaxException) {
        e.printStackTrace()
        null
    }
}

@SuppressLint("SetJavaScriptEnabled")
@Composable
fun TrulienceWebView(navController: NavController) {
    val context = LocalContext.current
    val pageURL = "file:///android_asset/embedded-web/index.html"

    var webViewState by remember { mutableStateOf<Bundle?>(null) }
    val webView = remember { WebView(context) }
    var pendingRequest by remember { mutableStateOf<PermissionRequest?>(null) }

    val permissionsLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val granted = permissions.entries.all { it.value }
        pendingRequest?.apply {
            if (granted) grant(resources) else deny()
        }
        pendingRequest = null
    }

    val coordinator = remember { Coordinator(webView) }

    DisposableEffect(Unit) {
        onDispose {
            val bundle = Bundle()
            webView.saveState(bundle)
            webViewState = bundle
        }
    }

    AndroidView(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black)
            .imePadding()
            .statusBarsPadding(),
        factory = {
            if (webViewState != null) {
                webView.restoreState(webViewState!!)
            }

            webView.apply {
                settings.javaScriptEnabled = true
                settings.domStorageEnabled = true
                settings.mediaPlaybackRequiresUserGesture = false
                settings.loadWithOverviewMode = true
                settings.useWideViewPort = true
                settings.cacheMode = WebSettings.LOAD_CACHE_ELSE_NETWORK

                layoutParams = ViewGroup.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.MATCH_PARENT
                )

                // For handling permission request
                webChromeClient  = object : WebChromeClient() {
                    override fun onPermissionRequest(request: PermissionRequest) {
                        coordinator.handleMediaCapturePermission(request, permissionsLauncher) { newPendingRequest ->
                            pendingRequest = newPendingRequest
                        }
                    }
                }

                webViewClient = object : WebViewClient() {
                    override fun shouldOverrideUrlLoading(
                        view: WebView,
                        request: WebResourceRequest
                    ): Boolean {
                        view.loadUrl(request.url.toString())
                        return true
                    }

                    override fun onPageFinished(view: WebView?, url: String?) {
                        view?.let {
                            val connectionInfo = navController
                                .previousBackStackEntry
                                ?.savedStateHandle
                                ?.get<ConnectionInfo>("connectionInfo")
                            if(connectionInfo !== null) {
                                coordinator.sendAgoraDetailsToReact(connectionInfo = connectionInfo)
                            }
                        }
                    }
                }

                addJavascriptInterface(
                    object {
                        @JavascriptInterface
                        fun onMessage(name: String, body: String?) {
                            // Parse the body as a String (as it's assumed to be JSON)
                            val jsonString = body as? String ?: return
                            // Parse the JSON string into a Map before the `when` block
                            val parsedPayload = parseJsonToMap(jsonString)

                            coordinator.userContentController(name, body = parsedPayload)
                        }
                    },
                    "AndroidNativeHandler"
                )

                loadUrl(pageURL)
            }
        },
        update = {
            // Optional: update logic if needed
        }
    )
}

