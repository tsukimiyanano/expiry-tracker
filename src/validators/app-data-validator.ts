import { APP_DATA_VERSION } from '@/constants/app-data'

import type { AppData } from '@/types/app-data'
import type { Category } from '@/types/category'
import type { ItemGroup } from '@/types/item-group'
import type { Item } from '@/types/item'

import { StringUtils } from '@/utils/string'
import { ArrayUtils } from '@/utils/array'
import { ObjectUtils } from '@/utils/object'

function isCategory(value: unknown): value is Category {
  return (
    ObjectUtils.isRecord(value) &&
    StringUtils.isString(value.id) &&
    value.id.length > 0 &&
    StringUtils.isString(value.name) &&
    value.name.trim().length > 0 &&
    StringUtils.isString(value.description)
  )
}

function isItemGroup(value: unknown): value is ItemGroup {
  return (
    ObjectUtils.isRecord(value) &&
    StringUtils.isString(value.id) &&
    value.id.length > 0 &&
    StringUtils.isString(value.name) &&
    value.name.trim().length > 0 &&
    ArrayUtils.isStringArray(value.categoryIds) &&
    StringUtils.isString(value.createdAt) &&
    StringUtils.isString(value.updatedAt)
  )
}

function isItem(value: unknown): value is Item {
  return (
    ObjectUtils.isRecord(value) &&
    StringUtils.isString(value.id) &&
    value.id.length > 0 &&
    StringUtils.isString(value.groupId) &&
    value.groupId.length > 0 &&
    (value.productName === null || StringUtils.isString(value.productName)) &&
    StringUtils.isString(value.expireDate) &&
    /^\d{4}-\d{2}-\d{2}$/.test(value.expireDate) &&
    typeof value.isUsed === 'boolean' &&
    StringUtils.isString(value.note) &&
    StringUtils.isString(value.createdAt) &&
    StringUtils.isString(value.updatedAt)
  )
}

/**
 * 校验应用数据结构与关联关系。
 */
export function validateAppData(value: unknown): asserts value is AppData {
  if (
    !ObjectUtils.isRecord(value) ||
    value.version !== APP_DATA_VERSION ||
    !Array.isArray(value.groups) ||
    !Array.isArray(value.items) ||
    !Array.isArray(value.categories)
  ) {
    throw new Error('应用数据格式无效或版本不受支持')
  }

  if (
    !value.groups.every(isItemGroup) ||
    !value.items.every(isItem) ||
    !value.categories.every(isCategory)
  ) {
    throw new Error('应用数据中存在无效记录')
  }

  const groups = value.groups
  const items = value.items
  const categories = value.categories

  // 检查所有 ID 的唯一性
  const allIds = [
    ...groups.map((group) => group.id),
    ...items.map((item) => item.id),
    ...categories.map((category) => category.id),
  ]

  if (new Set(allIds).size !== allIds.length) {
    throw new Error('应用数据中存在重复 ID')
  }

  const groupIds = new Set(groups.map((group) => group.id))
  const categoryIds = new Set(categories.map((category) => category.id))

  // 检查物品是否关联有效分组
  for (const item of items) {
    if (!groupIds.has(item.groupId)) {
      throw new Error(`物品 ${item.id} 引用了不存在的分组`)
    }
  }

  // 检查分组中的分类关联
  for (const group of groups) {
    if (new Set(group.categoryIds).size !== group.categoryIds.length) {
      throw new Error(`分组 ${group.id} 存在重复分类`)
    }

    for (const categoryId of group.categoryIds) {
      if (!categoryIds.has(categoryId)) {
        throw new Error(`分组 ${group.id} 引用了不存在的分类`)
      }
    }
  }

  // 分类名称唯一性：忽略首尾空格和大小写
  const normalizedNames = categories.map((category) =>
    category.name.trim().toLowerCase(),
  )

  if (new Set(normalizedNames).size !== normalizedNames.length) {
    throw new Error('应用数据中存在重复分类名称')
  }
}
