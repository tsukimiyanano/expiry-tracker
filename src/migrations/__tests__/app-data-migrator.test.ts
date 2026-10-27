import { describe, expect, it } from 'vitest'

import { migrateAppData } from '@/migrations/app-data-migrator'
import { createAppDataV1, createAppDataV2 } from '@/test/fixtures/app-data'

describe('migrateAppData', () => {
  it('V1 自动迁移至 V2', () => {
    const result = migrateAppData(createAppDataV1())

    expect(result.sourceVersion).toBe(1)
    expect(result.targetVersion).toBe(2)
    expect(result.migrated).toBe(true)
    expect(result.data.version).toBe(2)
  })

  it('V2 直接通过校验', () => {
    const result = migrateAppData(createAppDataV2())

    expect(result.sourceVersion).toBe(2)
    expect(result.targetVersion).toBe(2)
    expect(result.migrated).toBe(false)
  })

  it.each([
    null,
    [],
    {},
    { version: 0 },
    { version: '1' },
    { version: 1.5 },
    { version: 3 },
    { version: 999 },
  ])('拒绝不支持或无效的数据：%j', (value) => {
    expect(() => migrateAppData(value)).toThrow()
  })

  it('拒绝缺少必要字段的 V1 数据', () => {
    const data = createAppDataV1()

    const invalid = {
      ...data,
      categories: [
        {
          id: 'category-1',
          // 缺少 name
        },
      ],
    }

    expect(() => migrateAppData(invalid)).toThrow()
  })

  it('拒绝不存在的分类引用', () => {
    const data = createAppDataV1()

    data.groups[0].categoryIds = ['missing-category']

    expect(() => migrateAppData(data)).toThrow()
  })

  it('拒绝重复的分类名称', () => {
    const data = createAppDataV1()

    data.categories.push({
      id: 'category-2',
      name: '  乳制品  ',
    })

    expect(() => migrateAppData(data)).toThrow()
  })

  it('迁移结果通过当前数据校验器', () => {
    const result = migrateAppData(createAppDataV1())

    expect(result.data.version).toBe(2)
    expect(result.data.categories[0].description).toBe('')
  })

  it('迁移不会修改输入对象', () => {
    const original = createAppDataV1()
    const snapshot = structuredClone(original)

    migrateAppData(original)

    expect(original).toEqual(snapshot)
  })
})
