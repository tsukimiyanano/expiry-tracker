<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { RouterView } from 'vue-router'
import { exit, onBackButtonPress } from '@tauri-apps/api/app'
import { isTauri } from '@tauri-apps/api/core'
import type { PluginListener } from '@tauri-apps/api/core'

import { runBackButtonHandlers } from '@/composables/useBackButtonHandler'

let backButtonListener: PluginListener | null = null

async function handleBackButtonPress(canGoBack: boolean) {
  // 打开中的弹窗优先处理，返回 false 时继续走路由回退或退出应用。
  if (await runBackButtonHandlers()) return

  if (canGoBack) {
    window.history.back()
    return
  }

  try {
    await exit(0)
  } catch {
    // 退出失败时保持应用运行，避免返回键被完全吞掉。
  }
}

onMounted(async () => {
  // 浏览器环境没有 Android 返回键，保留开发调试时的默认行为。
  if (!isTauri()) return

  try {
    backButtonListener = await onBackButtonPress(({ canGoBack }) => {
      void handleBackButtonPress(canGoBack)
    })
  } catch {
    // 注册失败时保留系统默认返回行为。
  }
})

onUnmounted(() => {
  void backButtonListener?.unregister()
})
</script>

<template>
  <div class="app-container">
    <RouterView />
  </div>
</template>

<style>
*,
*::before,
*::after {
  box-sizing: border-box;
}

html,
body,
#app {
  width: 100%;
  min-height: 100%;
  margin: 0;
}

body {
  font-family:
    system-ui,
    -apple-system,
    'Segoe UI',
    sans-serif;
  background-color: #fff;
  color: #323233;
}

.app-container {
  padding-top: env(safe-area-inset-top, 0px);
  padding-bottom: env(safe-area-inset-bottom, 0px);
}
</style>
