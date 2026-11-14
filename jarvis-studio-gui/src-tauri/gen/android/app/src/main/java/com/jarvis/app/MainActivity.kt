package com.jarvis.app

import android.content.Intent
import android.content.res.Configuration
import android.graphics.Color
import android.os.Bundle
import android.webkit.WebView
import androidx.activity.SystemBarStyle
import androidx.activity.enableEdgeToEdge
import com.jarvis.phone.RoutineAlarms
import com.jarvis.phone.ShareInbox

class MainActivity : TauriActivity() {
  override fun onWebViewCreate(webView: WebView) {
    super.onWebViewCreate(webView)
    // Hardware/runtime identity, not screen size: a tablet is still a touch device.
    if (resources.configuration.uiMode and Configuration.UI_MODE_TYPE_MASK ==
        Configuration.UI_MODE_TYPE_TELEVISION) {
      webView.settings.userAgentString += " JarvisTV/1"
    }
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    // The UI is always dark. The default (auto) style follows the SYSTEM theme, so a
    // phone in light mode drew dark status-bar icons on the dark HUD — unreadable.
    enableEdgeToEdge(
      statusBarStyle = SystemBarStyle.dark(Color.TRANSPARENT),
      navigationBarStyle = SystemBarStyle.dark(Color.TRANSPARENT),
    )
    super.onCreate(savedInstanceState)
    RoutineAlarms.takeTap(intent)
    ShareInbox.take(intent)
  }

  // A routine notification's tap is taken here, not in PhonePlugin: Tauri registers its
  // plugins only after the WebView starts, and a tap that brings a killed JARVIS back
  // arrives as onNewIntent before that, so the plugin never saw it (2026-10-18, live).
  // A share from another app's Share sheet arrives the same way.
  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    RoutineAlarms.takeTap(intent)
    ShareInbox.take(intent)
  }
}
