import type { Category } from '@/types/category'
import { StringUtils } from '@/utils/string'

export interface ResolvedCategoryNames {
  categories: Category[]
  categoryIds: string[]
}

/**
 * 将分类名称解析为分类关联 ID。
 *
 * 规则：按去空格、小写归一化后去重；已存在的分类直接复用，
 * 不存在的分类创建新记录并追加到返回的分类数组中。
 * 不修改传入的 categories 数组。
 */
export function resolveCategoryNames(
  categories: Category[],
  names: string[],
): ResolvedCategoryNames {
  const nextCategories = [...categories]
  const categoryIds: string[] = []
  const seenNames = new Set<string>()

  for (const rawName of names) {
    const categoryName = rawName.trim()
    const normalizedName = StringUtils.normalizeName(categoryName)

    if (!normalizedName || seenNames.has(normalizedName)) {
      continue
    }

    seenNames.add(normalizedName)

    let category = nextCategories.find(
      (item) => StringUtils.normalizeName(item.name) === normalizedName,
    )

    if (!category) {
      category = {
        id: StringUtils.createId('cat'),
        name: categoryName,
        description: '',
      }

      nextCategories.push(category)
    }

    categoryIds.push(category.id)
  }

  return {
    categories: nextCategories,
    categoryIds,
  }
}
