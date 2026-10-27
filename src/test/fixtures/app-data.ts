import type { AppData } from '@/types/app-data'
import type { AppDataV1 } from '@/types/migrations/app-data-v1'

/**
 * 创建一份合法 V1 应用数据。
 *
 * 使用函数工厂而不是共享对象，避免测试之间的修改互相影响。
 */
export function createAppDataV1(): AppDataV1 {
  return {
    version: 1,
    groups: [
      {
        id: 'group-1',
        name: '牛奶',
        categoryIds: ['category-1'],
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ],
    items: [
      {
        id: 'item-1',
        groupId: 'group-1',
        productName: null,
        expireDate: '2026-12-31',
        isUsed: false,
        note: '',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ],
    categories: [
      {
        id: 'category-1',
        name: '乳制品',
      },
    ],
  }
}

/**
 * 创建一份合法 V2 应用数据。
 */
export function createAppDataV2(): AppData {
  const v1 = createAppDataV1()

  return {
    version: 2,
    groups: v1.groups.map((group) => ({
      ...group,
      categoryIds: [...group.categoryIds],
    })),
    items: v1.items.map((item) => ({ ...item })),
    categories: v1.categories.map((category) => ({
      ...category,
      description: '',
    })),
  }
}
