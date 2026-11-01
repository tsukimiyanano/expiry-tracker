import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { appDataRepository } from '@/repositories/app-data-repository'
import { notificationScheduler } from '@/services/notification/notification-scheduler'
import { notificationService } from '@/services/notification/notification-service'
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
        const loadedData = await appDataRepository.load()

        data.value = loadedData
        initialized.value = true

        // 应用启动时根据磁盘中的正式数据修复通知调度状态。
        void notificationScheduler.sync(loadedData).catch((cause) => {
          console.error('初始化到期提醒失败：', cause)
        })
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

  /**
   * 用户主动开启到期提醒
   *
   * 权限申请由用户操作触发，避免应用启动时突然弹出系统授权框。
   * 权限被拒绝返回 false；同步失败会向调用方抛出异常。
   */
  async function enableNotifications(): Promise<boolean> {
    const granted = await notificationService.requestNotificationPermission()

    if (!granted) {
      return false
    }

    await initialize()

    if (data.value) {
      await notificationScheduler.sync(data.value)
    }

    return true
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
    enableNotifications,
    ...mutations,
  }
})
