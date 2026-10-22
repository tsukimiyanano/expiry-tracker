import { onUnmounted } from 'vue'

type BackButtonHandler = () => boolean | Promise<boolean>

const handlers: BackButtonHandler[] = []

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

  return () => {
    const index = handlers.indexOf(handler)

    if (index !== -1) {
      handlers.splice(index, 1)
    }
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
 * 组件卸载时自动注销。
 */
export function useBackButtonHandler(
  isActive: () => boolean,
  handler: () => void | Promise<void>,
) {
  const unregister = registerBackButtonHandler(() => {
    if (!isActive()) return false

    void Promise.resolve(handler()).catch(() => undefined)

    return true
  })

  onUnmounted(unregister)
}
