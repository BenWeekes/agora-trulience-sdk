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
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.derivedStateOf
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
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import androidx.navigation.compose.rememberNavController
import java.io.Serializable

data class ConnectionInfo(
    var appId: String = "",
    var channelName: String = "",
    var uid: String = ""
) : Serializable

/**
 * ContentView composable displays a UI for entering Agora connection details.
 */

@Composable
fun ContentView(navController: NavController) {
    // Internal connection info state
    var connectionInfo by remember { mutableStateOf(ConnectionInfo(
        appId =  "20b7c51ff4c644ab80cf5a4e646b0537",
        channelName = "convoAI",
        uid = "111"
    )) }

    val isValid = remember(connectionInfo) {
        derivedStateOf {
            connectionInfo.appId.isNotBlank() &&
                    connectionInfo.channelName.isNotBlank() &&
                    connectionInfo.uid.isNotBlank()
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(
                brush = Brush.linearGradient(
                    colors = listOf(Color.Blue, Color(0xFF800080)), // blue to purple
                    start = Offset(0f, 0f),
                    end = Offset.Infinite
                )
            )
            .padding(20.dp)
    ) {
        Column(
            verticalArrangement = Arrangement.Top,
            modifier = Modifier.fillMaxSize().align(Alignment.Center)
        ) {
            Spacer(modifier = Modifier.height(24.dp))

            Text(
                text = "Connection Details",
                fontSize = 30.sp,
                fontWeight = FontWeight.Bold,
                color = Color.White,
                modifier = Modifier.padding(bottom = 30.dp).align(Alignment.CenterHorizontally)
            )

            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Color.White.copy(alpha = 0.3f), shape = RoundedCornerShape(15.dp))
                    .padding(16.dp)
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(
                        text = "Agora Details",
                        style = MaterialTheme.typography.headlineSmall,
                        color = Color.White
                    )

                    Spacer(modifier = Modifier.height(8.dp))

                    CustomTextField("App ID", connectionInfo.appId) {
                        connectionInfo = connectionInfo.copy(appId = it)
                    }

                    CustomTextField("Channel Name", connectionInfo.channelName) {
                        connectionInfo = connectionInfo.copy(channelName = it)
                    }

                    CustomTextField("UID", connectionInfo.uid, KeyboardType.Number) {
                        connectionInfo = connectionInfo.copy(uid = it)
                    }
                }
            }

            Spacer(modifier = Modifier.height(24.dp))

            // Gradient Button
            Button(
                onClick = {
                    navController.currentBackStackEntry?.savedStateHandle?.set("connectionInfo", connectionInfo)
                    navController.navigate(Screen.WebView.route)
                },
                enabled = isValid.value,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(50.dp)
                    .padding(horizontal = 4.dp),
                contentPadding = PaddingValues(),
                colors = ButtonDefaults.buttonColors(
                    containerColor = Color.Transparent,
                    disabledContainerColor = Color.Gray
                ),
                shape = RoundedCornerShape(10.dp),
                elevation = ButtonDefaults.buttonElevation(5.dp)
            ) {
                // Gradient background inside button
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(
                            brush = Brush.horizontalGradient(
                                colors = listOf(Color(0xFFFF4081), Color(0xFFFF9800))
                            ),
                            shape = RoundedCornerShape(10.dp)
                        ),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "Connect",
                        fontWeight = FontWeight.SemiBold,
                        color = if (isValid.value) Color.White else Color.LightGray
                    )
                }
            }

            Spacer(modifier = Modifier.weight(1f))
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