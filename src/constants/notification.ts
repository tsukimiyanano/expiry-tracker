/**
 * 到期提醒提前天数
 */
export const EXPIRY_REMINDER_DAYS = [7, 3, 0] as const

/**
 * 每日通知时间
 */
export const NOTIFICATION_HOUR = 9
export const NOTIFICATION_MINUTE = 0

/**
 * 到期提醒通知标题前缀
 *
 * 用于在全量同步时识别本应用创建的通知。
 */
export const EXPIRY_NOTIFICATION_TITLE_PREFIX = '到期提醒：'
