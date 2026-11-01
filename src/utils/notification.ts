import type { Item } from '@/types/item'
import type { ExpiryReminder } from '@/types/notification'
import {
  EXPIRY_REMINDER_DAYS,
  EXPIRY_NOTIFICATION_TITLE_PREFIX,
  NOTIFICATION_HOUR,
  NOTIFICATION_MINUTE,
} from '@/constants/notification'
import { DateUtils } from '@/utils/date'

/**
 * 按本地日历日期减去指定天数，返回 YYYY-MM-DD。
 *
 * 使用本地日期分量构造 Date，避免把日期字符串当作 UTC 解析后
 * 发生日期偏移。
 */
function subtractDays(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number)

  const result = new Date(year, month - 1, day - days)

  const resultYear = result.getFullYear()
  const resultMonth = String(result.getMonth() + 1).padStart(2, '0')
  const resultDay = String(result.getDate()).padStart(2, '0')

  return `${resultYear}-${resultMonth}-${resultDay}`
}

/**
 * 将 YYYY-MM-DD 转换为本地时区的通知时间。
 */
function toLocalDateTime(date: string): Date {
  const [year, month, day] = date.split('-').map(Number)

  return new Date(
    year,
    month - 1,
    day,
    NOTIFICATION_HOUR,
    NOTIFICATION_MINUTE,
    0,
    0,
  )
}

/**
 * 计算单个物品的所有待发送到期提醒。
 *
 * - 已使用物品不提醒。
 * - 已过期物品不提醒（其提醒时间均已过去，因此被过滤）。
 * - 只返回尚未到达的提醒时间，避免错过时间的提醒被补发。
 */
export function getExpiryReminders(
  item: Item,
  groupName: string,
  now: Date = new Date(),
): ExpiryReminder[] {
  if (item.isUsed || !DateUtils.isValidDateOnly(item.expireDate)) {
    return []
  }

  const itemName = item.productName
    ? `${groupName}（${item.productName}）`
    : groupName

  return EXPIRY_REMINDER_DAYS.flatMap((daysBefore) => {
    const reminderDate = subtractDays(item.expireDate, daysBefore)
    const scheduledAt = toLocalDateTime(reminderDate)

    if (scheduledAt.getTime() <= now.getTime()) {
      return []
    }

    const title =
      daysBefore === 0
        ? `${EXPIRY_NOTIFICATION_TITLE_PREFIX}今天到期`
        : `${EXPIRY_NOTIFICATION_TITLE_PREFIX}${daysBefore} 天后到期`

    return [
      {
        itemId: item.id,
        daysBefore,
        scheduledAt,
        title,
        body: `${itemName}将于 ${item.expireDate} 到期`,
      },
    ]
  })
}
