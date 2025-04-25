import org.gradle.api.tasks.Copy
import java.io.File

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.jetbrains.kotlin.android)
}

android {
    namespace = "com.example.agora_trulience_sdk"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.example.agora_trulience_sdk"
        minSdk = 24
        targetSdk = 34
        versionCode = 1
        versionName = "1.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        vectorDrawables {
            useSupportLibrary = true
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_1_8
        targetCompatibility = JavaVersion.VERSION_1_8
    }
    kotlinOptions {
        jvmTarget = "1.8"
    }
    buildFeatures {
        compose = true
    }
    composeOptions {
        kotlinCompilerExtensionVersion = "1.5.1"
    }
    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }
}

dependencies {

    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.activity.compose)
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.ui)
    implementation(libs.androidx.ui.graphics)
    implementation(libs.androidx.ui.tooling.preview)
    implementation(libs.androidx.material3)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.navigation.compose)
    implementation(libs.gson)
    testImplementation(libs.junit)
    androidTestImplementation(libs.androidx.junit)
    androidTestImplementation(libs.androidx.espresso.core)
    androidTestImplementation(platform(libs.androidx.compose.bom))
    androidTestImplementation(libs.androidx.ui.test.junit4)
    debugImplementation(libs.androidx.ui.tooling)
    debugImplementation(libs.androidx.ui.test.manifest)
}

// Register a custom Gradle task to copy the React build into the Android assets directory
tasks.register<Copy>("copyReactBuild") {

    val reactBuildDir = File(rootDir, "../react/build").canonicalFile
    val destinationDir = File(projectDir, "src/main/assets/embedded-web").canonicalFile

    // check that the React build exists and has content
    logger.lifecycle("🔍 Checking React build at: ${reactBuildDir.absolutePath}")

    if (!reactBuildDir.exists() || reactBuildDir.listFiles().isNullOrEmpty()) {
        throw GradleException(
            """
               ❌ React web build not found or is empty at: ${reactBuildDir.absolutePath}.
               Please run 'pnpm build' inside the react folder before building the Android app.
            """.trimIndent()
        )
    }

    // Set the source directory and include all files recursively
    from(reactBuildDir) {
        include("**/*") // Copy all files
    }

    // Set the destination directory inside the Android assets
    into(destinationDir)

    // Log success after files are copied
    doLast {
        logger.lifecycle("✅ React build copied to: ${destinationDir.absolutePath}")
    }
}

// Ensure the React build copy task runs before the Android `preBuild` task
tasks.named("preBuild").configure {
    dependsOn("copyReactBuild")
}

