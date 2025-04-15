//
//  ContentView.swift
//  agora-trulience-sdk
//
//  Created by Mateusz on 08/04/2025.
//

import SwiftUI

struct ConnectionInfo {
    var appId: String = ""
    var channelName: String = ""
    var uid: String = ""
}

struct ContentView: View {
    @State private var connectionInfo = ConnectionInfo(
        appId: "20b7c51ff4c644ab80cf5a4e646b0537",
        channelName: "convoAI",
        uid: "111"
    )
    
    @State private var navigateToWebView = false
    
    var body: some View {
        NavigationView {
            ZStack {
                // Gradient background
                LinearGradient(
                    gradient: Gradient(colors: [.blue, .purple]),
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing)
                .edgesIgnoringSafeArea(.all)
                
                VStack(spacing: 30) {
                    // Title
                    Text("Connection Details")
                        .font(.largeTitle)
                        .fontWeight(.bold)
                        .foregroundColor(.white)
                        .padding(.top, 20)
                    
                    // Connection Details Card
                    VStack(alignment: .leading, spacing: 15) {
                        Text("Agora Details")
                            .font(.headline)
                            .foregroundColor(.white)
                        
                        // Text Fields
                        TextField("App ID", text: $connectionInfo.appId)
                            .textFieldStyle(RoundedBorderTextFieldStyle())
                            .autocapitalization(.none)
                        
                        TextField("Channel Name", text: $connectionInfo.channelName)
                            .textFieldStyle(RoundedBorderTextFieldStyle())
                            .autocapitalization(.none)
                        
                        TextField("UID", text: $connectionInfo.uid)
                            .textFieldStyle(RoundedBorderTextFieldStyle())
                            .keyboardType(.numberPad)
                    }
                    .padding()
                    .background(Color.white.opacity(0.2))
                    .cornerRadius(15)
                    .padding(.horizontal)
                    
                    // Connect Button inside NavigationLink
                    NavigationLink(
                        destination: LazyView(
                            WebView(
                                url: Bundle.main.url(
                                    forResource: "index",
                                    withExtension: "html",
                                    subdirectory: "build")!,
                                connectionInfo: connectionInfo
                            )
                            .navigationBarHidden(true)
                            .edgesIgnoringSafeArea([.top, .bottom])
                        ),
                        isActive: $navigateToWebView,
                        label: {
                            // Button styling
                            Button(action: {
                                navigateToWebView = true
                            }, label: {
                                Text("Connect")
                                    .font(.headline)
                                    .foregroundColor(.white)
                                    .padding()
                                    .frame(maxWidth: .infinity)
                                    .background(
                                        LinearGradient(
                                            gradient: Gradient(colors: [.pink, .orange]),
                                            startPoint: .leading,
                                            endPoint: .trailing)
                                    )
                                    .cornerRadius(10)
                                    .shadow(color: .black.opacity(0.3), radius: 5, x: 0, y: 5)
                            })
                            .padding(.horizontal)
                        }
                    )
                    .disabled(connectionInfo.appId.isEmpty ||
                              connectionInfo.channelName.isEmpty ||
                              connectionInfo.uid.isEmpty)
                    
                    Spacer()
                }
                .padding()
            }
            .navigationBarHidden(true)
        }
    }
}

#Preview {
    ContentView()
}
