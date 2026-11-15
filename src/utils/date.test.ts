import { describe, expect, it } from 'vitest'

import { DateUtils } from './date'

describe('DateUtils.getMsUntilNextMidnight', () => {
  it('应该返回距离当天 24 点的毫秒数', () => {
    const now = new Date(2026, 10, 15, 23, 59)

    expect(DateUtils.getMsUntilNextMidnight(now)).toBe(60 * 1000)
  })

  it('零点时应该返回完整一天的毫秒数', () => {
    const now = new Date(2026, 10, 15, 0, 0)

    expect(DateUtils.getMsUntilNextMidnight(now)).toBe(24 * 60 * 60 * 1000)
  })
})
