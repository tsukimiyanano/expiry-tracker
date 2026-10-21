package com.home.expirytracker

import android.os.Bundle
import android.view.View
import androidx.activity.enableEdgeToEdge
import androidx.core.graphics.Insets
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat

class MainActivity : TauriActivity() {
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
}