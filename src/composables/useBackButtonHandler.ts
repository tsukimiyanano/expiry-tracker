import { onUnmounted, watch } from 'vue'

type BackButtonHandler = () => boolean | Promise<boolean>

const handlers: BackButtonHandler[] = []
const changeListeners = new Set<() => void>()

function notifyChange() {
  for (const listener of changeListeners) {
    listener()
  }
}

/**
 * 注册返回键处理器，返回注销函数。
 *
 * 处理器按后注册优先执行；返回 true 表示已消费本次返回键，
 * 返回 false 时继续交给其他处理器。
 */
export function registerBackButtonHandler(
  handler: BackButtonHandler,
): () => void {
  handlers.push(handler)
  notifyChange()

  return () => {
    const index = handlers.indexOf(handler)

    if (index === -1) return

    handlers.splice(index, 1)
    notifyChange()
  }
}

export function hasBackButtonHandlers(): boolean {
  return handlers.length > 0
}

/**
 * 订阅处理器数量变化，用于动态注册 / 注销平台的返回键监听。
 */
export function subscribeBackButtonHandlers(listener: () => void): () => void {
  changeListeners.add(listener)

  return () => {
    changeListeners.delete(listener)
  }
}

export async function runBackButtonHandlers(): Promise<boolean> {
  for (let index = handlers.length - 1; index >= 0; index -= 1) {
    if (await handlers[index]()) {
      return true
    }
  }

  return false
}

/**
 * 组件内注册返回键处理器，仅在 isActive() 为 true 时消费返回键。
 * 弹窗关闭后自动注销，让系统恢复默认返回行为；组件卸载时同样注销。
 */
export function useBackButtonHandler(
  isActive: () => boolean,
  handler: () => void | Promise<void>,
) {
  let unregister: (() => void) | null = null

  function sync(active: boolean) {
    if (active && !unregister) {
      unregister = registerBackButtonHandler(() => {
        void Promise.resolve(handler()).catch(() => undefined)

        return true
      })

      return
    }

    if (!active && unregister) {
      unregister()
      unregister = null
    }
  }

  watch(isActive, (active) => sync(active), { immediate: true })

  onUnmounted(() => {
    unregister?.()
    unregister = null
  })
}
