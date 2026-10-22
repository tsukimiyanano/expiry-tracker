import { onMounted, onUnmounted } from 'vue'
import { onBackButtonPress } from '@tauri-apps/api/app'
import { isTauri } from '@tauri-apps/api/core'
import type { PluginListener } from '@tauri-apps/api/core'

import {
  hasBackButtonHandlers,
  runBackButtonHandlers,
  subscribeBackButtonHandlers,
} from '@/composables/useBackButtonHandler'

/**
 * 接管 Android 返回键：仅在存在打开中的弹窗时注册监听，
 * 弹窗全部关闭后注销，把返回键交还系统默认行为
 * （无路由历史时退到后台，而不是结束应用进程）。
 *
 * 只应在根组件调用一次。
 */
export function useBackButtonController() {
  let listener: PluginListener | null = null
  let unsubscribeHandlers: (() => void) | null = null
  // 注册 / 注销是异步操作，用队列避免快速开关弹窗时产生竞态。
  let syncQueue: Promise<void> = Promise.resolve()

  async function handleBackButtonPress(canGoBack: boolean) {
    if (await runBackButtonHandlers()) return

    // 注销瞬间的竞态兜底：保留路由回退，不主动结束应用。
    if (canGoBack) {
      window.history.back()
    }
  }

  function syncListener() {
    syncQueue = syncQueue
      .then(async () => {
        const shouldListen = hasBackButtonHandlers()

        if (shouldListen && !listener) {
          listener = await onBackButtonPress(({ canGoBack }) => {
            void handleBackButtonPress(canGoBack)
          })

          return
        }

        if (!shouldListen && listener) {
          const registered = listener
          listener = null

          await registered.unregister()
        }
      })
      .catch(() => undefined)
  }

  onMounted(() => {
    // 浏览器环境没有 Android 返回键，保留开发调试时的默认行为。
    if (!isTauri()) return

    unsubscribeHandlers = subscribeBackButtonHandlers(syncListener)
    syncListener()
  })

  onUnmounted(() => {
    unsubscribeHandlers?.()
    unsubscribeHandlers = null

    if (listener) {
      const registered = listener
      listener = null

      void registered.unregister().catch(() => undefined)
    }
  })
}
