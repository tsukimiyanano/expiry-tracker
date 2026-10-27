import { describe, expect, it } from 'vitest'

import { migrateV1ToV2 } from '@/migrations/v1-to-v2'
import { createAppDataV1 } from '@/test/fixtures/app-data'

describe('migrateV1ToV2', () => {
  it('将合法 V1 数据转换为 V2', () => {
    const v1 = createAppDataV1()

    const result = migrateV1ToV2(v1)

    expect(result.version).toBe(2)

    expect(result.categories).toEqual([
      {
        id: 'category-1',
        name: '乳制品',
        description: '',
      },
    ])

    expect(result.groups).toEqual(v1.groups)
    expect(result.items).toEqual(v1.items)
  })

  it('不会修改原始 V1 数据', () => {
    const original = createAppDataV1()
    const snapshot = structuredClone(original)

    migrateV1ToV2(original)

    expect(original).toEqual(snapshot)
  })

  it('迁移结果与原始对象不共享可变引用', () => {
    const original = createAppDataV1()
    const result = migrateV1ToV2(original)

    expect(result).not.toBe(original)
    expect(result.groups).not.toBe(original.groups)
    expect(result.items).not.toBe(original.items)
    expect(result.categories).not.toBe(original.categories)

    expect(result.groups[0]).not.toBe(original.groups[0])
    expect(result.groups[0].categoryIds).not.toBe(
      original.groups[0].categoryIds,
    )

    expect(result.items[0]).not.toBe(original.items[0])
  })
})
