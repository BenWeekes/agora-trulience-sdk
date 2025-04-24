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
    var avatarId: String = ""
    var voiceId: String = ""
    var prompt: String = ""
    var greeting: String = ""
}

struct ContentView: View {
    @State private var connectionInfo = ConnectionInfo(
        appId: "20b7c51ff4c644ab80cf5a4e646b0537",
        channelName: "random",
        uid: "111",
        avatarId: "3384296204170052843"
    )
    
    @State private var navigateToWebView = false
    
    var body: some View {
        NavigationView {
            ZStack {
                VStack(spacing: 30) {
                    // Title
                    Text("Agora convoAI and\nTrulience Avatar Demo")
                        .font(.title)
                        .fontWeight(.bold)
                        .foregroundColor(.white)
                        .padding(.top, 20)
                        .multilineTextAlignment(.center)
                    
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
                        
                        TextField("Avatar ID", text: $connectionInfo.avatarId)
                            .textFieldStyle(RoundedBorderTextFieldStyle())
                            .keyboardType(.numberPad)
                        
                        TextField("Voice ID", text: $connectionInfo.voiceId)
                            .textFieldStyle(RoundedBorderTextFieldStyle())
                            .autocapitalization(.none)
                        
                        TextField("Prompt", text: $connectionInfo.prompt)
                            .textFieldStyle(RoundedBorderTextFieldStyle())
                            .autocapitalization(.none)
                        
                        TextField("Greeting", text: $connectionInfo.greeting)
                            .textFieldStyle(RoundedBorderTextFieldStyle())
                            .autocapitalization(.none)
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
                            .edgesIgnoringSafeArea([.bottom])
                            .background(Color.black) 
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
                                        .purple
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
            }.background(.blue)
            .navigationBarHidden(true)
        }
    }
}

#Preview {
    ContentView()
}
