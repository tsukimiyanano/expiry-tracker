import type { AppData } from '@/types/app-data'
import type { ExpiryReminder } from '@/types/notification'

import { EXPIRY_NOTIFICATION_TITLE_PREFIX } from '@/constants/notification'
import { notificationService } from './notification-service'
import { getExpiryReminders } from '@/utils/notification'
import { AsyncUtils } from '@/utils/async'

/**
 * 根据物品 ID 和提醒天数生成稳定的通知 ID。
 *
 * Tauri 通知插件要求通知 ID 为 32 位整数，而业务物品 ID 为字符串，
 * 因此使用 FNV-1a 哈希建立稳定映射，便于修改或删除物品时准确取消。
 */
function createNotificationId(itemId: string, daysBefore: number): number {
  const value = `${itemId}:${daysBefore}`

  let hash = 2166136261

  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }

  // 保留为正整数，并避免使用 0。
  return ((hash >>> 0) % 2_147_483_647) + 1
}

interface ScheduledReminder {
  id: number
  reminder: ExpiryReminder
}

/**
 * 从应用数据中生成所有有效提醒。
 */
function collectReminders(data: AppData): ScheduledReminder[] {
  const groupMap = new Map(data.groups.map((group) => [group.id, group.name]))

  const scheduled: ScheduledReminder[] = []
  const usedIds = new Set<number>()

  for (const item of data.items) {
    const groupName = groupMap.get(item.groupId)

    if (!groupName) continue

    const reminders = getExpiryReminders(item, groupName)

    for (const reminder of reminders) {
      const id = createNotificationId(reminder.itemId, reminder.daysBefore)

      if (usedIds.has(id)) {
        throw new Error(`通知 ID 冲突：${id}`)
      }

      usedIds.add(id)
      scheduled.push({ id, reminder })
    }
  }

  return scheduled
}

async function syncNow(data: AppData): Promise<void> {
  if (!(await notificationService.hasPermission())) {
    return
  }

  // 先计算并验证全部通知，避免计算失败后先取消旧通知。
  const reminders = collectReminders(data)

  const pendingNotifications =
    await notificationService.getPendingNotifications()

  // 只取消标题前缀属于本应用的通知，不使用 cancelAll()。
  const ownNotificationIds = pendingNotifications
    .filter((notification) =>
      notification.title?.startsWith(EXPIRY_NOTIFICATION_TITLE_PREFIX),
    )
    .map((notification) => notification.id)

  await notificationService.cancelNotifications(ownNotificationIds)

  // 根据最新数据重新安排通知。
  for (const { id, reminder } of reminders) {
    await notificationService.scheduleReminder(id, reminder)
  }
}

// 同步可能被数据变更与应用启动并发触发，串行执行避免相互取消刚安排的通知。
const syncQueue = AsyncUtils.createSerialQueue()

/**
 * 将系统待发送通知与当前应用数据重新同步。
 *
 * 权限未授予时静默跳过，由用户主动开启提醒后再同步。
 */
function sync(data: AppData): Promise<void> {
  return syncQueue.enqueue(() => syncNow(data))
}

export const notificationScheduler = {
  sync,
}
