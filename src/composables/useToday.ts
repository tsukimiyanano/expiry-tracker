import { readonly, ref } from 'vue'
import { DateUtils } from '@/utils/date'

const today = ref(DateUtils.getTodayDateOnly())

let refreshTimer: ReturnType<typeof setTimeout> | null = null
let started = false

function refreshToday() {
  today.value = DateUtils.getTodayDateOnly()
}

function scheduleNextRefresh() {
  if (refreshTimer !== null) {
    clearTimeout(refreshTimer)
  }

  refreshTimer = setTimeout(() => {
    refreshToday()
    scheduleNextRefresh()
  }, DateUtils.getMsUntilNextMidnight())
}

function handleVisibilityChange() {
  if (document.visibilityState !== 'visible') return

  refreshToday()
  // 后台期间定时器可能被系统暂停，回到前台后重新对齐。
  scheduleNextRefresh()
}

/**
 * 全局共享的本地「今天」（YYYY-MM-DD）。
 *
 * 跨过 0 点或从后台回到前台时自动更新，供到期状态等派生数据依赖。
 */
export function useToday() {
  if (!started) {
    started = true
    refreshToday()
    scheduleNextRefresh()

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange)
    }
  }

  return readonly(today)
}
