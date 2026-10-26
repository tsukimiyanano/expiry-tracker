import type { AppData } from '@/types/app-data'
import type { AppDataV1 } from '@/types/migrations/app-data-v1'

/**
 * V1 → V2
 *
 * 新增分类描述字段，旧数据统一使用空字符串。
 * 不修改原始数据，不执行文件 IO。
 */
export function migrateV1ToV2(data: AppDataV1): AppData {
  return {
    version: 2,
    groups: data.groups.map((group) => ({
      ...group,
      categoryIds: [...group.categoryIds],
    })),
    items: data.items.map((item) => ({ ...item })),
    categories: data.categories.map((category) => ({
      ...category,
      description: '',
    })),
  }
}
