import { ref } from 'vue'
import { showConfirmDialog } from 'vant'

/**
 * 表单未保存修改保护。
 *
 * 只负责比较快照与弹出确认框，不依赖具体业务数据；
 * 快照应只包含表单实际可编辑的值。
 */
export function useUnsavedChangesGuard() {
  const initialSnapshot = ref('')

  function captureInitialState(value: unknown) {
    initialSnapshot.value = JSON.stringify(value)
  }

  function hasChanges(value: unknown): boolean {
    return JSON.stringify(value) !== initialSnapshot.value
  }

  async function confirmDiscard(value: unknown): Promise<boolean> {
    if (!hasChanges(value)) return true

    try {
      await showConfirmDialog({
        title: '放弃修改？',
        message: '当前有未保存的修改，确定放弃吗？',
        confirmButtonText: '放弃修改',
        confirmButtonColor: 'var(--van-danger-color)',
      })

      return true
    } catch {
      return false
    }
  }

  return {
    captureInitialState,
    hasChanges,
    confirmDiscard,
  }
}
