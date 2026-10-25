import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { appDataRepository } from '@/repositories/app-data-repository'
import { ErrorUtils } from '@/utils/error'
import type { AppData } from '@/types/app-data'
import { useAppDataMutations } from '@/composables/useAppDataMutations'

export const useAppDataStore = defineStore('app-data', () => {
  const data = ref<AppData | null>(null)

  const loading = ref(false)
  const initialized = ref(false)
  const saving = ref(false)
  const error = ref<string | null>(null)

  const groups = computed(() => data.value?.groups ?? [])
  const items = computed(() => data.value?.items ?? [])
  const categories = computed(() => data.value?.categories ?? [])

  let initializationPromise: Promise<void> | null = null

  function initialize(): Promise<void> {
    if (initialized.value && data.value) {
      return Promise.resolve()
    }

    if (initializationPromise) {
      return initializationPromise
    }

    loading.value = true
    error.value = null

    const task = (async () => {
      try {
        data.value = await appDataRepository.load()
        initialized.value = true
      } catch (cause) {
        error.value = ErrorUtils.getMessage(cause)
        throw cause
      } finally {
        loading.value = false
      }
    })()

    initializationPromise = task

    // 初始化失败后允许调用方重试。
    // 清除缓存的 Promise，让下一次调用 initialize() 能重新尝试初始化。
    void task.catch(() => {
      if (initializationPromise === task) {
        initializationPromise = null
      }
    })

    return task
  }

  const mutations = useAppDataMutations({
    data,
    initialize,
    error,
    saving,
  })

  /**
   * 使用导入数据整体替换应用数据
   *
   * 复用变更队列与安全写入流程；保存失败时不更新 Store 数据。
   */
  async function importData(importedData: AppData): Promise<void> {
    if (!initialized.value) {
      throw new Error('应用数据尚未初始化，无法导入')
    }

    await mutations.replaceAllData(importedData)
  }

  /**
   * 强制从磁盘重新读取数据
   *
   * 恢复流程替换正式文件后，内存中的旧状态必须丢弃；
   * initialize() 在已初始化时不会重新读取，因此需要单独提供该方法。
   */
  async function reload(): Promise<void> {
    initialized.value = false
    data.value = null
    initializationPromise = null

    await initialize()
  }

  return {
    data,
    groups,
    items,
    categories,
    loading,
    initialized,
    saving,
    error,
    initialize,
    importData,
    reload,
    ...mutations,
  }
})
