package com.home.expirytracker

import android.os.Bundle
import android.view.View
import android.webkit.JavascriptInterface
import android.webkit.WebView
import androidx.activity.enableEdgeToEdge
import androidx.core.graphics.Insets
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat

class MainActivity : TauriActivity() {
    private var navigationBarBottomPx = 0

    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)

        val contentView = findViewById<View>(android.R.id.content)

        // 保存初始内边距，避免反复累加
        val initialLeft = contentView.paddingLeft
        val initialTop = contentView.paddingTop
        val initialRight = contentView.paddingRight
        val initialBottom = contentView.paddingBottom

        ViewCompat.setOnApplyWindowInsetsListener(contentView) { view, insets ->
            // 记录系统导航栏底部高度（手势条或三键导航），供 Web 层预留安全距离
            navigationBarBottomPx = insets
                .getInsets(WindowInsetsCompat.Type.navigationBars())
                .bottom

            // 获取系统输入法占用的底部高度，单位为 px
            val imeBottom = insets
                .getInsets(WindowInsetsCompat.Type.ime())
                .bottom

            // 输入法弹出时缩小 WebView 的可用布局区域
            view.setPadding(
                initialLeft,
                initialTop,
                initialRight,
                maxOf(initialBottom, imeBottom)
            )

            // 已通过 padding 处理输入法占用空间，
            // 不再将 IME 高度重复传递给子 View
            WindowInsetsCompat.Builder(insets)
                .setInsets(
                    WindowInsetsCompat.Type.ime(),
                    Insets.NONE
                )
                .build()
        }

        ViewCompat.requestApplyInsets(contentView)
    }

    override fun onWebViewCreate(webView: WebView) {
        super.onWebViewCreate(webView)

        // 低版本 WebView 不支持 env(safe-area-inset-*)，
        // 通过 JS 接口把导航栏高度（CSS px）提供给前端自行预留
        webView.post {
            webView.addJavascriptInterface(
                SafeAreaBridge(),
                "AndroidSafeArea"
            )
        }
    }

    inner class SafeAreaBridge {
        @JavascriptInterface
        fun getBottomInsetCssPx(): Float =
            navigationBarBottomPx / resources.displayMetrics.density
    }
}
