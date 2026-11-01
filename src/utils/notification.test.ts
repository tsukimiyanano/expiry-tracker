import { describe, expect, it } from 'vitest'

import type { Item } from '@/types/item'
import { getExpiryReminders } from './notification'

function createItem(overrides: Partial<Item> = {}): Item {
  return {
    id: 'item-1',
    groupId: 'group-1',
    productName: null,
    expireDate: '2026-11-07',
    isUsed: false,
    note: '',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('getExpiryReminders', () => {
  it('应该计算提前 7 天、3 天和当天的提醒', () => {
    const reminders = getExpiryReminders(
      createItem(),
      '牛奶',
      new Date(2026, 9, 30, 10, 0),
    )

    expect(reminders.map(({ daysBefore }) => daysBefore)).toEqual([7, 3, 0])

    expect(
      reminders.map(({ scheduledAt }) => [
        scheduledAt.getFullYear(),
        scheduledAt.getMonth() + 1,
        scheduledAt.getDate(),
        scheduledAt.getHours(),
        scheduledAt.getMinutes(),
      ]),
    ).toEqual([
      [2026, 10, 31, 9, 0],
      [2026, 11, 4, 9, 0],
      [2026, 11, 7, 9, 0],
    ])
  })

  it('应该跳过已经错过的提醒时间', () => {
    const reminders = getExpiryReminders(
      createItem(),
      '牛奶',
      new Date(2026, 9, 31, 9, 0),
    )

    expect(reminders.map(({ daysBefore }) => daysBefore)).toEqual([3, 0])
  })

  it('已使用物品不应该产生提醒', () => {
    const reminders = getExpiryReminders(
      createItem({ isUsed: true }),
      '牛奶',
      new Date(2026, 9, 30, 8, 0),
    )

    expect(reminders).toEqual([])
  })

  it('已过期物品不应该产生提醒', () => {
    const reminders = getExpiryReminders(
      createItem({ expireDate: '2026-10-29' }),
      '牛奶',
      new Date(2026, 9, 30, 8, 0),
    )

    expect(reminders).toEqual([])
  })

  it('无效的到期日期不应该产生提醒', () => {
    const reminders = getExpiryReminders(
      createItem({ expireDate: '2026-02-30' }),
      '牛奶',
      new Date(2026, 9, 30, 8, 0),
    )

    expect(reminders).toEqual([])
  })

  it('有子商品名称时应该同时显示分组名称和商品名称', () => {
    const reminders = getExpiryReminders(
      createItem({ productName: '1L装' }),
      '牛奶',
      new Date(2026, 9, 30, 10, 0),
    )

    expect(reminders[0].body).toBe('牛奶（1L装）将于 2026-11-07 到期')
  })
})
