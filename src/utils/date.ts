import { EXPIRY_WARNING_DAYS } from '@/constants/expiry'

export type ExpiryStatus = 'used' | 'expired' | 'today' | 'soon' | 'normal'

export interface ExpiryStatusInfo {
  status: ExpiryStatus
  label: string
  daysRemaining: number | null
}

const DAY_IN_MS = 24 * 60 * 60 * 1000

/**
 * 返回本地时区的今天，格式为 YYYY-MM-DD。
 *
 * 独立为模块函数，避免 DateUtils 在自身初始化中引用自身。
 */
function getLocalTodayDateOnly(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

export const DateUtils = {
  /**
   * 校验 YYYY-MM-DD 格式的日期字符串，且日期必须真实存在。
   */
  isValidDateOnly(value: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return false
    }

    const date = new Date(`${value}T00:00:00.000Z`)

    return (
      !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
    )
  },

  /**
   * 返回本地时区的今天，格式为 YYYY-MM-DD。
   */
  getTodayDateOnly(): string {
    return getLocalTodayDateOnly()
  },

  /**
   * 计算物品的到期状态。
   *
   * 优先级：已用完 > 已过期 > 今天到期 > 即将到期（默认 7 天内）> 正常。
   * 日期差值按 UTC 计算，避免时区偏移。
   */
  getExpiryStatus(
    expireDate: string,
    isUsed = false,
    today = getLocalTodayDateOnly(),
    soonDays = EXPIRY_WARNING_DAYS,
  ): ExpiryStatusInfo {
    if (isUsed) {
      return {
        status: 'used',
        label: '已用完',
        daysRemaining: null,
      }
    }

    if (
      !DateUtils.isValidDateOnly(expireDate) ||
      !DateUtils.isValidDateOnly(today)
    ) {
      throw new Error('无效的日期')
    }

    const daysRemaining =
      (Date.parse(`${expireDate}T00:00:00Z`) -
        Date.parse(`${today}T00:00:00Z`)) /
      DAY_IN_MS

    if (daysRemaining < 0) {
      return { status: 'expired', label: '已过期', daysRemaining }
    }

    if (daysRemaining === 0) {
      return { status: 'today', label: '今天到期', daysRemaining }
    }

    if (daysRemaining <= soonDays) {
      return { status: 'soon', label: '即将到期', daysRemaining }
    }

    return { status: 'normal', label: '正常', daysRemaining }
  },
}
