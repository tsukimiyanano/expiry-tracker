<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { RouterView } from 'vue-router'
import { onBackButtonPress } from '@tauri-apps/api/app'
import { isTauri } from '@tauri-apps/api/core'
import type { PluginListener } from '@tauri-apps/api/core'

import {
  hasBackButtonHandlers,
  runBackButtonHandlers,
  subscribeBackButtonHandlers,
} from '@/composables/useBackButtonHandler'

let backButtonListener: PluginListener | null = null
let unsubscribeHandlers: (() => void) | null = null
let syncQueue: Promise<void> = Promise.resolve()

async function handleBackButtonPress(canGoBack: boolean) {
  if (await runBackButtonHandlers()) return

  // 注销瞬间的竞态兜底：保留路由回退，不主动结束应用。
  if (canGoBack) {
    window.history.back()
  }
}

/**
 * 只有存在打开中的弹窗时才注册返回键监听。
 * 全部弹窗关闭后注销，把返回键交还给 Android 默认行为
 * （无路由历史时退到后台，而不是结束应用进程）。
 */
function syncBackButtonListener() {
  syncQueue = syncQueue
    .then(async () => {
      const shouldListen = hasBackButtonHandlers()

      if (shouldListen && !backButtonListener) {
        backButtonListener = await onBackButtonPress(({ canGoBack }) => {
          void handleBackButtonPress(canGoBack)
        })

        return
      }

      if (!shouldListen && backButtonListener) {
        const listener = backButtonListener
        backButtonListener = null

        await listener.unregister()
      }
    })
    .catch(() => undefined)
}

onMounted(() => {
  // 浏览器环境没有 Android 返回键，保留开发调试时的默认行为。
  if (!isTauri()) return

  unsubscribeHandlers = subscribeBackButtonHandlers(syncBackButtonListener)
  syncBackButtonListener()
})

onUnmounted(() => {
  unsubscribeHandlers?.()
  unsubscribeHandlers = null

  if (backButtonListener) {
    const listener = backButtonListener
    backButtonListener = null

    void listener.unregister().catch(() => undefined)
  }
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
