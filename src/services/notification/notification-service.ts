import {
  cancel,
  isPermissionGranted,
  pending,
  requestPermission,
  Schedule,
  sendNotification,
} from '@tauri-apps/plugin-notification'
import type { PendingNotification } from '@tauri-apps/plugin-notification'

import type { ExpiryReminder } from '@/types/notification'

/**
 * 定时调度与权限接口仅在 Android 上可用。
 */
function isAndroid(): boolean {
  return (
    typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent)
  )
}

/**
 * 检查通知权限。
 *
 * 只查询状态，不会弹出系统授权窗口。
 */
async function hasPermission(): Promise<boolean> {
  if (!isAndroid()) return false

  return isPermissionGranted()
}

/**
 * 主动请求通知权限。
 *
 * 应由用户主动操作触发，不建议应用启动时自动弹出权限请求。
 */
async function requestNotificationPermission(): Promise<boolean> {
  if (!isAndroid()) return false

  const permission = await requestPermission()

  return permission === 'granted'
}

/**
 * 获取待发送通知。
 */
async function getPendingNotifications(): Promise<PendingNotification[]> {
  if (!isAndroid()) return []

  return pending()
}

/**
 * 取消指定通知。
 */
async function cancelNotifications(ids: number[]): Promise<void> {
  if (ids.length === 0 || !isAndroid()) return

  await cancel(ids)
}

/**
 * 安排一条到期提醒。
 *
 * 插件当前的 sendNotification() 签名为同步 void（内部经异步桥接发送），
 * 因此这里只负责调用，无法等待或获取底层发送结果。
 */
async function scheduleReminder(
  id: number,
  reminder: ExpiryReminder,
): Promise<void> {
  if (!isAndroid()) return

  sendNotification({
    id,
    title: reminder.title,
    body: reminder.body,
    schedule: Schedule.at(reminder.scheduledAt, false, true),
  })
}

export const notificationService = {
  hasPermission,
  requestNotificationPermission,
  getPendingNotifications,
  cancelNotifications,
  scheduleReminder,
}
