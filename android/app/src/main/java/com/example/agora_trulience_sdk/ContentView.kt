package com.example.agora_trulience_sdk

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import androidx.navigation.compose.rememberNavController
import java.io.Serializable

data class ConnectionInfo(
    var appId: String = "",
    var channelName: String = "",
    var uid: String = "",
    var voiceId: String = "",
    var prompt: String = "",
    var greeting: String = "",
    var avatarId: String = ""
) : Serializable

/**
 * ContentView composable displays a UI for entering Agora connection details.
 */

@Composable
fun ContentView(navController: NavController) {
    var connectionInfo by remember { mutableStateOf(ConnectionInfo(
        appId= "20b7c51ff4c644ab80cf5a4e646b0537",
        channelName= "random",
        uid= "111",
        avatarId= "9053143346212585739",
        voiceId = "",
        prompt = "",
        greeting = ""
    )) }

    val scrollState = rememberScrollState()

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(color = Color(0xFF007AFF))
            .padding(20.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(scrollState)
                .imePadding(), // Ensures padding when keyboard is shown
            verticalArrangement = Arrangement.Top,
        ) {
            Spacer(modifier = Modifier.height(24.dp))

            Text(
                text = "Agora convoAI and Trulience Avatar Demo",
                fontSize = 24.sp,
                fontWeight = FontWeight.Bold,
                color = Color.White,
                textAlign = TextAlign.Center,
                modifier = Modifier
                    .padding(bottom = 16.dp, top = 8.dp)
                    .align(Alignment.CenterHorizontally)
                    .width(250.dp)
            )

            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(color= Color(0x3395FFFF), shape = RoundedCornerShape(15.dp))
                    .padding(16.dp)
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(
                        text = "Agora Details",
                        style = MaterialTheme.typography.titleLarge,
                        color = Color.White
                    )

                    Spacer(modifier = Modifier.height(8.dp))

                    CustomTextField("App ID", connectionInfo.appId) {
                        connectionInfo = connectionInfo.copy(appId = it)
                    }

                    CustomTextField("Channel Name", connectionInfo.channelName, KeyboardType.Number) {
                        connectionInfo = connectionInfo.copy(channelName = it)
                    }

                    CustomTextField("UID", connectionInfo.uid, KeyboardType.Number) {
                        connectionInfo = connectionInfo.copy(uid = it)
                    }

                    CustomTextField("Avatar ID", connectionInfo.avatarId) {
                        connectionInfo = connectionInfo.copy(avatarId = it)
                    }

                    CustomTextField("Voice ID", connectionInfo.voiceId) {
                        connectionInfo = connectionInfo.copy(voiceId = it)
                    }

                    CustomTextField("Prompt", connectionInfo.prompt) {
                        connectionInfo = connectionInfo.copy(prompt = it)
                    }

                    CustomTextField("Greeting", connectionInfo.greeting) {
                        connectionInfo = connectionInfo.copy(greeting = it)
                    }
                }
            }

            Spacer(modifier = Modifier.height(24.dp))

            Button(
                onClick = {
                    navController.currentBackStackEntry?.savedStateHandle?.set("connectionInfo", connectionInfo)
                    navController.navigate(Screen.WebView.route)
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(50.dp)
                    .padding(horizontal = 4.dp),
                contentPadding = PaddingValues(),
                colors = ButtonDefaults.buttonColors(
                    containerColor = Color(0xffaf52de),
                    disabledContainerColor = Color.Gray
                ),
                shape = RoundedCornerShape(10.dp),
                elevation = ButtonDefaults.buttonElevation(5.dp)
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(
                           color = Color(0xffaf52de),
                            shape = RoundedCornerShape(10.dp)
                        ),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "Connect",
                        fontWeight = FontWeight.SemiBold,
                        color = Color.White
                    )
                }
            }

            Spacer(modifier = Modifier.height(24.dp))
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CustomTextField(
    label: String,
    value: String,
    keyboardType: KeyboardType = KeyboardType.Text,
    onValueChange: (String) -> Unit
) {
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        label = { Text(label, color = Color.White) },
        textStyle = TextStyle(color = Color.White),

        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        keyboardOptions = KeyboardOptions(keyboardType = keyboardType),
        colors = TextFieldDefaults.outlinedTextFieldColors(
            focusedBorderColor = Color.White,
            unfocusedBorderColor = Color.White,
            cursorColor = Color.White,
            focusedTextColor = Color.White,
            unfocusedTextColor = Color.White
        )
    )
}


@Preview(showBackground = true)
@Composable
fun PreviewContentView() {
    ContentView(navController = rememberNavController())
}