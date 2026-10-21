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
    ...mutations,
  }
})
