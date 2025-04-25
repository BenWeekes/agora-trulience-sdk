package com.example.agora_trulience_sdk

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.tooling.preview.Devices
import androidx.compose.ui.tooling.preview.Preview
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController

sealed class Screen(val route: String) {
    data object Home : Screen("home")
    data object WebView : Screen("webView")
}

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        setContent {
            Surface(
                modifier = Modifier.fillMaxSize(),
                color = MaterialTheme.colorScheme.background
            )
            {
                // Navigation
                val startDestination = intent.getStringExtra("destination")
                val navController = rememberNavController()
                NavHost(
                    navController = navController,
                    startDestination = startDestination ?: Screen.Home.route
                ) {

                    // ConnectionScreen composable displays a UI for entering Agora connection details.
                    composable(Screen.Home.route) {
                        ContentView(navController = navController)
                    }

                    composable(Screen.WebView.route) {
                        TrulienceWebView(navController = navController)
                    }

                }
            }
        }
    }
}


@Preview(showBackground = true, device = Devices.PIXEL)
@Composable
fun MainActivityPreview() {
    MainActivity()
}
