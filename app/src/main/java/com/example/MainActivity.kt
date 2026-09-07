package com.example

import android.annotation.SuppressLint
import android.content.Context
import android.os.Bundle
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.ui.Modifier
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat

import androidx.activity.OnBackPressedCallback

class MainActivity : ComponentActivity() {

    private var webViewRef: WebView? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                webViewRef?.evaluateJavascript(
                    "if (window.handleAndroidBack) { window.handleAndroidBack(); } else { window.history.back(); }",
                    null
                )
            }
        })

        setContent {
            AndroidView(
                modifier = Modifier.fillMaxSize(),
                factory = { context ->
                    WebView(context).apply {
                        webViewRef = this
                        configureWebView(this, context)
                        loadUrl("file:///android_asset/index.html")
                    }
                }
            )
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun configureWebView(webView: WebView, context: Context) {
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            allowFileAccess = true
            allowContentAccess = true
            mediaPlaybackRequiresUserGesture = false
            mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
            useWideViewPort = true
            loadWithOverviewMode = true
        }

        webView.webChromeClient = WebChromeClient()
        webView.webViewClient = object : WebViewClient() {}

        ViewCompat.setOnApplyWindowInsetsListener(webView) { _, insets ->
            val statusBarPx = insets.getInsets(WindowInsetsCompat.Type.statusBars()).top
            val density = context.resources.displayMetrics.density
            val statusBarDp = if (density > 0) (statusBarPx / density).toInt() else 36
            val safeDp = if (statusBarDp > 12) statusBarDp else 36

            val imeInsets = insets.getInsets(WindowInsetsCompat.Type.ime())
            val imeHeightPx = imeInsets.bottom
            val imeVisible = insets.isVisible(WindowInsetsCompat.Type.ime()) || imeHeightPx > 0
            val imeHeightDp = if (density > 0) (imeHeightPx / density).toInt() else 0

            webView.post {
                webView.evaluateJavascript(
                    "document.documentElement.style.setProperty('--android-status-bar-height', '${safeDp}px');" +
                    "document.documentElement.style.setProperty('--keyboard-height', '${imeHeightDp}px');" +
                    "if(window.__onNativeKeyboardChanged){ window.__onNativeKeyboardChanged($imeVisible, $imeHeightDp); }",
                    null
                )
            }
            insets
        }

        webView.addJavascriptInterface(WebAppInterface(context), "AndroidNative")
    }

    inner class WebAppInterface(private val context: Context) {

        @JavascriptInterface
        fun httpGet(callId: String, urlString: String, headersJson: String) {
            Thread {
                var conn: java.net.HttpURLConnection? = null
                try {
                    val url = java.net.URL(urlString)
                    conn = url.openConnection() as java.net.HttpURLConnection
                    conn.requestMethod = "GET"
                    conn.connectTimeout = 12000
                    conn.readTimeout = 12000
                    conn.instanceFollowRedirects = true

                    if (headersJson.isNotEmpty()) {
                        try {
                            val headers = org.json.JSONObject(headersJson)
                            val keys = headers.keys()
                            while (keys.hasNext()) {
                                val key = keys.next()
                                conn.setRequestProperty(key, headers.getString(key))
                            }
                        } catch (e: Exception) {
                            e.printStackTrace()
                        }
                    }

                    if (conn.getRequestProperty("User-Agent") == null) {
                        conn.setRequestProperty("User-Agent", "Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36")
                    }

                    val statusCode = conn.responseCode
                    val inputStream = if (statusCode in 200..299) conn.inputStream else conn.errorStream
                    val responseStr = if (inputStream != null) {
                        val reader = java.io.BufferedReader(java.io.InputStreamReader(inputStream, "UTF-8"))
                        val builder = StringBuilder()
                        var line: String?
                        while (reader.readLine().also { line = it } != null) {
                            builder.append(line)
                        }
                        reader.close()
                        builder.toString()
                    } else ""

                    val isSuccess = statusCode in 200..299
                    val escapedData = org.json.JSONObject.quote(responseStr)

                    runOnUiThread {
                        val js = "if(window.__nativeHttpCallback){ window.__nativeHttpCallback('$callId', $isSuccess, $statusCode, $escapedData, null); }"
                        webViewRef?.evaluateJavascript(js, null)
                    }
                } catch (e: Exception) {
                    val errorMsg = e.message ?: "Network error"
                    val escapedError = org.json.JSONObject.quote(errorMsg)
                    runOnUiThread {
                        val js = "if(window.__nativeHttpCallback){ window.__nativeHttpCallback('$callId', false, 0, null, $escapedError); }"
                        webViewRef?.evaluateJavascript(js, null)
                    }
                } finally {
                    conn?.disconnect()
                }
            }.start()
        }

        @JavascriptInterface
        fun getStatusBarHeight(): Int {
            return try {
                val resourceId = context.resources.getIdentifier("status_bar_height", "dimen", "android")
                if (resourceId > 0) {
                    val px = context.resources.getDimensionPixelSize(resourceId)
                    val density = context.resources.displayMetrics.density
                    val dp = (px / density).toInt()
                    if (dp > 12) dp else 36
                } else {
                    36
                }
            } catch (e: Exception) {
                36
            }
        }

        @JavascriptInterface
        fun showToast(message: String) {
            Toast.makeText(context, message, Toast.LENGTH_SHORT).show()
        }

        @JavascriptInterface
        fun getHistoryJson(): String {
            return ""
        }

        @JavascriptInterface
        fun saveHistoryJson(json: String) {
        }

        @JavascriptInterface
        fun getFavoritesJson(): String {
            return ""
        }

        @JavascriptInterface
        fun saveFavoritesJson(json: String) {
        }

        @JavascriptInterface
        fun isDownloaded(id: String): Boolean {
            return false
        }

        @JavascriptInterface
        fun getDownloadsJson(): String {
            return "[]"
        }

        @JavascriptInterface
        fun setScreenOrientation(isLandscape: Boolean) {
        }

        @JavascriptInterface
        fun setFullscreen(isFullscreen: Boolean) {
        }

        @JavascriptInterface
        fun exitApp() {
            runOnUiThread {
                moveTaskToBack(true)
            }
        }
    }
}
