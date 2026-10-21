import type { AppData } from '@/types/app-data'
import type { Category } from '@/types/category'
import type { Item } from '@/types/item'
import type { ItemGroup } from '@/types/item-group'
import { DateUtils } from '@/utils/date'
import { StringUtils } from '@/utils/string'

export interface UpdateGroupInput {
  name?: string
  categoryNames?: string[]
}

export interface UpdateItemInput {
  productName?: string | null
  expireDate?: string
  note?: string
  isUsed?: boolean
}

export type AppDataUpdater = <T>(
  operation: (current: AppData) => {
    nextData: AppData
    result: T
  },
) => Promise<T>

export function useAppDataEditing(updateData: AppDataUpdater) {
  function updateGroup(
    groupId: string,
    input: UpdateGroupInput,
  ): Promise<ItemGroup> {
    return updateData((current) => {
      const group = current.groups.find((g) => g.id === groupId)
      if (!group) throw new Error('找不到指定的物品分组')

      let name = group.name

      if (input.name !== undefined) {
        name = input.name.trim()
        if (!name) throw new Error('物品名称不能为空')
      }

      let categoryIds = group.categoryIds
      let categories = current.categories

      if (input.categoryNames !== undefined) {
        categories = [...current.categories]
        categoryIds = []
        const seen = new Set<string>()

        for (const rawName of input.categoryNames) {
          const categoryName = rawName.trim()
          const key = StringUtils.normalizeName(categoryName)

          if (!key || seen.has(key)) continue
          seen.add(key)

          let category = categories.find(
            (c) => StringUtils.normalizeName(c.name) === key,
          )

          if (!category) {
            category = {
              id: StringUtils.createId('cat'),
              name: categoryName,
            }
            categories.push(category)
          }

          categoryIds.push(category.id)
        }
      }

      const updatedGroup: ItemGroup = {
        ...group,
        name,
        categoryIds,
        updatedAt: new Date().toISOString(),
      }

      return {
        nextData: {
          ...current,
          categories,
          groups: current.groups.map((g) =>
            g.id === groupId ? updatedGroup : g,
          ),
        },
        result: updatedGroup,
      }
    })
  }

  function updateItem(itemId: string, input: UpdateItemInput): Promise<Item> {
    return updateData((current) => {
      const item = current.items.find((i) => i.id === itemId)
      if (!item) throw new Error('找不到指定的物品')

      if (
        input.expireDate !== undefined &&
        !DateUtils.isValidDateOnly(input.expireDate)
      ) {
        throw new Error('过期日期无效')
      }

      const updatedItem: Item = {
        ...item,
        productName:
          input.productName === undefined
            ? item.productName
            : input.productName?.trim() || null,
        expireDate: input.expireDate ?? item.expireDate,
        note: input.note === undefined ? item.note : input.note.trim(),
        isUsed: input.isUsed ?? item.isUsed,
        updatedAt: new Date().toISOString(),
      }

      return {
        nextData: {
          ...current,
          items: current.items.map((i) => (i.id === itemId ? updatedItem : i)),
        },
        result: updatedItem,
      }
    })
  }

  function renameCategory(categoryId: string, name: string): Promise<Category> {
    return updateData((current) => {
      const category = current.categories.find((c) => c.id === categoryId)
      if (!category) throw new Error('找不到指定的分类')

      const normalizedName = name.trim()
      const key = StringUtils.normalizeName(normalizedName)

      if (!key) throw new Error('分类名称不能为空')

      if (
        current.categories.some(
          (c) =>
            c.id !== categoryId && StringUtils.normalizeName(c.name) === key,
        )
      ) {
        throw new Error('已存在同名分类')
      }

      const updatedCategory: Category = {
        ...category,
        name: normalizedName,
      }

      return {
        nextData: {
          ...current,
          categories: current.categories.map((c) =>
            c.id === categoryId ? updatedCategory : c,
          ),
        },
        result: updatedCategory,
      }
    })
  }

  function deleteItem(itemId: string): Promise<void> {
    return updateData((current) => {
      const item = current.items.find((i) => i.id === itemId)
      if (!item) throw new Error('找不到指定的物品')

      const items = current.items.filter((i) => i.id !== itemId)
      const groupHasItems = items.some((i) => i.groupId === item.groupId)

      const groups = groupHasItems
        ? current.groups.map((g) =>
            g.id === item.groupId
              ? { ...g, updatedAt: new Date().toISOString() }
              : g,
          )
        : current.groups.filter((g) => g.id !== item.groupId)

      return {
        nextData: { ...current, items, groups },
        result: undefined,
      }
    })
  }

  function deleteGroup(groupId: string): Promise<void> {
    return updateData((current) => {
      if (!current.groups.some((g) => g.id === groupId)) {
        throw new Error('找不到指定的物品分组')
      }

      return {
        nextData: {
          ...current,
          groups: current.groups.filter((g) => g.id !== groupId),
          items: current.items.filter((i) => i.groupId !== groupId),
        },
        result: undefined,
      }
    })
  }

  function deleteCategory(categoryId: string): Promise<void> {
    return updateData((current) => {
      if (!current.categories.some((c) => c.id === categoryId)) {
        throw new Error('找不到指定的分类')
      }

      const now = new Date().toISOString()

      return {
        nextData: {
          ...current,
          categories: current.categories.filter((c) => c.id !== categoryId),
          groups: current.groups.map((group) => {
            if (!group.categoryIds.includes(categoryId)) return group

            return {
              ...group,
              categoryIds: group.categoryIds.filter((id) => id !== categoryId),
              updatedAt: now,
            }
          }),
        },
        result: undefined,
      }
    })
  }

  return {
    updateGroup,
    updateItem,
    renameCategory,
    deleteItem,
    deleteGroup,
    deleteCategory,
  }
}
