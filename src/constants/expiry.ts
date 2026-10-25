/**
 * 即将到期提示窗口（天）
 *
 * 剩余天数在该范围内时视为即将到期。
 */
export const EXPIRY_WARNING_DAYS = 7

/**
 * 倒计时按天展示的最大天数
 *
 * 超过该天数后改用「约 N 个月」表达。
 */
export const EXPIRY_COUNTDOWN_DAY_MAX_DAYS = 30

/**
 * 倒计时提示的最大天数（约半年）
 *
 * 超过该天数只展示到期日期，不再追加倒计时。
 */
export const EXPIRY_COUNTDOWN_MAX_DAYS = 180

/**
 * 按月展示倒计时时，每月约计天数
 */
export const APPROX_DAYS_PER_MONTH = 30
