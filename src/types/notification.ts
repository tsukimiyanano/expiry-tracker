/**
 * 一条待调度的到期提醒
 */
export interface ExpiryReminder {
  itemId: string
  daysBefore: number
  scheduledAt: Date
  title: string
  body: string
}
