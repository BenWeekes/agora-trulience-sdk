//
//  Webview.swift
//  agora-trulience-sdk
//
//  Created by Mateusz on 08/04/2025.
//

import SwiftUI
import WebKit
import UIKit
import SafariServices
import AVFoundation

class WebViewLogger: NSObject, WKScriptMessageHandler {
    var logs: [String] = []
    
    func log(_ message: String, prefix: String? = "") {
        let today = Date.now
        let formatter3 = DateFormatter()
        formatter3.dateFormat = "HH:mm:ss"
        let timestamp: String = formatter3.string(from: today)
        if let prefix = prefix {
            let loggedMessage: String = timestamp + " :: " + prefix + " :: " + message
            logs.append(loggedMessage)
            print(loggedMessage)
        } else {
            let loggedMessage: String = timestamp + " :: " + message
            logs.append(loggedMessage)
            print(loggedMessage)
        }
    }
    
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        if message.name == "consoleLog", let messageBody = message.body as? String {
            log(messageBody, prefix: "[WEB]")
//                print("WebView console log: \(messageBody)")
        }
    }
}

struct WebView: UIViewRepresentable {
    let logger = WebViewLogger()
    let url: URL
    let connectionInfo: ConnectionInfo
    
    lazy private var coordinator: Coordinator = Coordinator(self)
    
    private var webView: WKWebView
    
    init(url: URL, connectionInfo: ConnectionInfo) {
        print("webview constructor")
        self.url = url
        self.connectionInfo = connectionInfo
        self.webView = WebView.createWebView(logger: logger, url: url)
        if #available(iOS 16.4, *) {
            webView.isInspectable = true
        } else {
            // Fallback on earlier versions
        }
        
        webView.configuration.userContentController.add(coordinator, name: "trlAuthSuccess")
        webView.configuration.userContentController.add(coordinator, name: "trlAuthFail")
        webView.configuration.userContentController.add(coordinator, name: "trlWebsocketConnect")
        webView.configuration.userContentController.add(coordinator, name: "trlWebsocketClose")
        webView.configuration.userContentController.add(coordinator, name: "trlWebsocketMessage")
        webView.configuration.userContentController.add(coordinator, name: "trlLoadProgress")
        webView.configuration.userContentController.add(coordinator, name: "trlMicUpdate")
        webView.configuration.userContentController.add(coordinator, name: "trlMicAccess")
        webView.configuration.userContentController.add(coordinator, name: "trlSpeakerUpdate")
        webView.configuration.userContentController.add(coordinator, name: "trlChat")
        webView.configuration.userContentController.add(coordinator, name: "agoraUserPublished")
        webView.configuration.userContentController.add(coordinator, name: "agoraUserUnpublished")
        webView.configuration.userContentController.add(coordinator, name: "agoraUserJoined")
        webView.configuration.userContentController.add(coordinator, name: "agoraUserLeft")
    }
    
    func clearCache() {
        WKWebsiteDataStore.default().removeData(ofTypes: [WKWebsiteDataTypeDiskCache, WKWebsiteDataTypeMemoryCache], modifiedSince: Date(timeIntervalSince1970: 0), completionHandler:{ }) // debug: clear cache
    }
    
    static func createWebView(logger: WebViewLogger, url: URL) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        let source = """
        var originalConsoleLog = console.log;
        console.log = function() {
            var args = Array.from(arguments).map(function(arg) {
                if (typeof arg === 'undefined') {
                    return 'undefined';
                } else if (arg === null) {
                    return 'null';
                } else if (typeof arg === 'object') {
                    try {
                        return JSON.stringify(arg);
                    } catch (error) {
                        return '[Object]';
                    }
                } else {
                    return arg.toString();
                }
            });
            window.webkit.messageHandlers.consoleLog.postMessage(args.join(' '));
            originalConsoleLog.apply(console, arguments);
        };
        
        var originalConsoleDebug = console.debug;
        console.debug = function() {
            var args = Array.from(arguments).map(function(arg) {
                if (typeof arg === 'undefined') {
                    return 'undefined';
                } else if (arg === null) {
                    return 'null';
                } else if (typeof arg === 'object') {
                    try {
                        return JSON.stringify(arg);
                    } catch (error) {
                        return '[Object]';
                    }
                } else {
                    return arg.toString();
                }
            });
            window.webkit.messageHandlers.consoleLog.postMessage(`ConsoleDebug: ${args.join(' ')}`);
            originalConsoleDebug.apply(console, arguments);
        };
        
        var originalError = console.error;
        console.error = function() {
            var args = Array.from(arguments).map(function(arg) {
                if (typeof arg === 'undefined') {
                    return 'undefined';
                } else if (arg === null) {
                    return 'null';
                } else if (typeof arg === 'object') {
                    try {
                        return JSON.stringify(arg);
                    } catch (error) {
                        return '[Object]';
                    }
                } else {
                    return arg.toString();
                }
            });
            window.webkit.messageHandlers.consoleLog.postMessage(`ConsoleError: ${args.join(' ')}`);
            originalError.apply(console, arguments);
        };
        """
        let userScript = WKUserScript(source: source, injectionTime: .atDocumentEnd, forMainFrameOnly: false)

        configuration.userContentController.addUserScript(userScript)
        configuration.userContentController.add(logger, name: "consoleLog")
        
        configuration.allowsInlineMediaPlayback = true
        configuration.suppressesIncrementalRendering = true
        configuration.defaultWebpagePreferences.allowsContentJavaScript = true
        
        let pref = WKWebpagePreferences.init()
        pref.allowsContentJavaScript = true
        pref.preferredContentMode = .mobile
        configuration.defaultWebpagePreferences = pref
        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.allowsBackForwardNavigationGestures = true
        webView.loadFileURL(url, allowingReadAccessTo: url.deletingLastPathComponent())
        webView.isOpaque = false // fixes white background flash
        webView.configuration.preferences.setValue(true, forKey: "allowFileAccessFromFileURLs") // fixes AudioWorklet API issues with mouth
        webView.configuration.setValue(true, forKey: "allowUniversalAccessFromFileURLs")
        
        do {
            try AVAudioSession.sharedInstance().setCategory(.playAndRecord, options: [.defaultToSpeaker, .allowBluetooth])
            try AVAudioSession.sharedInstance().setActive(true, options: .notifyOthersOnDeactivation)
        } catch {
            print("Failed to set audio session category.")
        }

        
        return webView
    }
    
    func communicateSafeAreaBounds(bounds: UIEdgeInsets) {
        let arg: [String: Any] = [
            "top": bounds.top,
            "bottom": bounds.bottom
        ]
        print("arg: \(arg)")
        callJavaScriptFunction(functionName: "eventNativeSafeAreaBoundsUpdated", parameter: arg)
    }
    
    func reload() {
        webView.loadFileURL(url, allowingReadAccessTo: url.deletingLastPathComponent())
    }
    
    func dismissWebView() {
        self.webView.pauseAllMediaPlayback()
    }
    
    func makeUIView(context: Context) -> WKWebView {
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.uiDelegate = context.coordinator
        webView.navigationDelegate = context.coordinator
        return webView
    }
    
    func updateUIView(_ uiView: WKWebView, context: Context) {
    }
    
    func redraw() {
        callJavaScriptFunction(functionName: "redraw")
    }
    
    func callJavaScriptFunction(functionName: String, parameter: Any? = nil) {
        var script: String
        
        if let param = parameter {
            if let jsonData = try? JSONSerialization.data(withJSONObject: param, options: .fragmentsAllowed),
               let jsonString = String(data: jsonData, encoding: .utf8) {
                script = "window?.NativeBridge?.\(functionName)(\(jsonString));"
            } else {
                print("Error serializing JSON")
                return
            }
        } else {
            script = "window?.NativeBridge?.\(functionName)();"
        }
        logger.log(script, prefix: "[NATIVE]");
        webView.evaluateJavaScript(script) { (result, error) in
            if let error = error {
                print("Error calling JavaScript function: \(error)")
            }
            print("Result \(result ?? "None")")
        }
    }
    
    func makeCoordinator() -> Coordinator {
        Coordinator(self)
    }
    
    func sendAgoraDetailsToReact(connectionInfo: ConnectionInfo) {
        let arg: [String: Any] = [
            "appId": connectionInfo.appId,
            "channelName": connectionInfo.channelName,
            "uid": connectionInfo.uid
        ]
        print("arg: \(arg)")
        callJavaScriptFunction(functionName: "agoraDetailsUpdated", parameter: arg)
    }
}

class Coordinator: NSObject, WKScriptMessageHandler, WKUIDelegate, WKNavigationDelegate {
    var parent: WebView
    
    init(_ parent: WebView) {
        self.parent = parent
    }
    
    func webView(_ webView: WKWebView, decideMediaCapturePermissionsFor origin: WKSecurityOrigin,
                 initiatedBy frame: WKFrameInfo, type: WKMediaCaptureType) async -> WKPermissionDecision {
        return .grant
    }
    
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        // WebView finished loading, ready to send details to React
        parent.logger.log("WebView did finish loading", prefix: "[NATIVE]")
        print("webview loaded, sending \(parent.connectionInfo)")
        parent.sendAgoraDetailsToReact(connectionInfo: parent.connectionInfo)
    }
    
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        parent.logger.log("userContentController: \(message.name) \(message.body)", prefix: "[NATIVE]")
        if message.name == "trlAuthSuccess" {
            // handle event
        } else if message.name == "trlAuthFail" {
            // handle event
        } else if message.name == "trlWebsocketConnect" {
            // handle event
        } else if message.name == "trlWebsocketClose" {
            // handle event
        } else if message.name == "trlWebsocketMessage" {
            // handle event
        } else if message.name == "trlLoadProgress" {
            // handle event
        } else if message.name == "trlMicUpdate" {
            // handle event
        } else if message.name == "trlMicAccess" {
            // handle event
        } else if message.name == "trlSpeakerUpdate" {
            // handle event
        } else if message.name == "trlChat" {
            // handle event
        } else if message.name == "trlAuthFail" {
            // handle event
        } else if message.name == "agoraUserPublished" {
            // handle event
        } else if message.name == "agoraUserUnpublished" {
            // handle event
        } else if message.name == "agoraUserJoined" {
            // handle event
        } else if message.name == "agoraUserLeft" {
            // handle event
        }
    }
}

extension Coordinator: SFSafariViewControllerDelegate {
    func safariViewControllerDidFinish(_ controller: SFSafariViewController) {
        controller.dismiss(animated: true, completion: nil)
    }
}
