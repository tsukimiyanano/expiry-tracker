import type { Ref } from 'vue'

import { appDataRepository } from '@/repositories/app-data-repository'
import { resolveCategoryNames } from '@/services/category-service'
import { useAppDataEditing } from '@/composables/useAppDataEditing'
import { AsyncUtils } from '@/utils/async'
import { ErrorUtils } from '@/utils/error'
import { DateUtils } from '@/utils/date'
import { StringUtils } from '@/utils/string'
import { validateAppData } from '@/validators/app-data-validator'
import type { AppData } from '@/types/app-data'
import type { Item } from '@/types/item'
import type { ItemGroup } from '@/types/item-group'

export interface CreateItemInput {
  name: string
  categoryNames?: string[]
  productName?: string | null
  expireDate: string
  note?: string
}

export interface AddItemToGroupInput {
  productName?: string | null
  expireDate: string
  note?: string
}

interface DataUpdateResult<T> {
  nextData: AppData
  result: T
}

interface AppDataMutationOptions {
  data: Ref<AppData | null>
  initialize: () => Promise<void>
  error: Ref<string | null>
  saving: Ref<boolean>
}

function createItemRecord(input: AddItemToGroupInput, groupId: string): Item {
  if (!DateUtils.isValidDateOnly(input.expireDate)) {
    throw new Error('请填写有效的过期日期')
  }

  const now = new Date().toISOString()
  const productName = input.productName?.trim() || null

  return {
    id: StringUtils.createId('item'),
    groupId,
    productName,
    expireDate: input.expireDate,
    isUsed: false,
    note: input.note?.trim() ?? '',
    createdAt: now,
    updatedAt: now,
  }
}

export function useAppDataMutations(options: AppDataMutationOptions) {
  const { data, initialize, error, saving } = options

  // 变更串行执行；单个操作失败不阻塞后续操作。
  const mutationQueue = AsyncUtils.createSerialQueue()
  let pendingMutationCount = 0

  function updateData<T>(
    operation: (
      current: AppData,
    ) => DataUpdateResult<T> | Promise<DataUpdateResult<T>>,
  ): Promise<T> {
    pendingMutationCount += 1
    saving.value = true

    return mutationQueue.enqueue(async () => {
      error.value = null

      try {
        await initialize()

        const current = data.value

        if (!current) {
          throw new Error('应用数据尚未初始化')
        }

        const { nextData, result } = await operation(current)

        await appDataRepository.save(nextData)

        // 只有保存成功后，才提交新的响应式状态。
        data.value = nextData

        return result
      } catch (cause) {
        error.value = ErrorUtils.getMessage(cause)
        throw cause
      } finally {
        pendingMutationCount -= 1
        saving.value = pendingMutationCount > 0
      }
    })
  }

  function createItem(
    input: CreateItemInput,
  ): Promise<{ group: ItemGroup; item: Item }> {
    return updateData((current) => {
      const name = input.name.trim()

      if (!name) {
        throw new Error('物品名称不能为空')
      }

      const now = new Date().toISOString()
      const { categories: nextCategories, categoryIds } = resolveCategoryNames(
        current.categories,
        input.categoryNames ?? [],
      )

      const group: ItemGroup = {
        id: StringUtils.createId('grp'),
        name,
        categoryIds,
        createdAt: now,
        updatedAt: now,
      }

      const item = createItemRecord(input, group.id)

      return {
        nextData: {
          ...current,
          groups: [...current.groups, group],
          items: [...current.items, item],
          categories: nextCategories,
        },
        result: { group, item },
      }
    })
  }

  function addItemToGroup(
    groupId: string,
    input: AddItemToGroupInput,
  ): Promise<Item> {
    return updateData((current) => {
      const groupExists = current.groups.some((group) => group.id === groupId)

      if (!groupExists) {
        throw new Error('找不到指定的物品分组')
      }

      const item = createItemRecord(input, groupId)

      return {
        nextData: {
          ...current,
          groups: current.groups.map((group) =>
            group.id === groupId
              ? { ...group, updatedAt: item.createdAt }
              : group,
          ),
          items: [...current.items, item],
        },
        result: item,
      }
    })
  }

  const editing = useAppDataEditing(updateData)

  /**
   * 使用导入数据整体替换现有数据
   *
   * 写入新数据前先保存当前数据快照，供用户在导入后撤销；
   * 克隆一份副本，避免导入结果与调用方持有的对象共享引用。
   * 保存成功前不会修改当前响应式数据。
   */
  function replaceAllData(importedData: AppData): Promise<void> {
    validateAppData(importedData)

    return updateData(async (current) => {
      // 快照失败会中止导入，正式数据保持不变。
      await appDataRepository.saveImportSnapshot(current)

      return {
        nextData: structuredClone(importedData),
        result: undefined,
      }
    })
  }

  return {
    createItem,
    addItemToGroup,
    replaceAllData,
    ...editing,
  }
}
