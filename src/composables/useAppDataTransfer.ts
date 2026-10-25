import { ref } from 'vue'
import { showConfirmDialog } from 'vant'

import { appDataRepository } from '@/repositories/app-data-repository'
import { appDataTransferRepository } from '@/repositories/app-data-transfer-repository'
import { useAppDataStore } from '@/stores/app-data-store'
import type { AppData } from '@/types/app-data'
import type { ImportDataSummary } from '@/types/data-transfer'
import { DataTransferError } from '@/utils/data-transfer-error'

function getDataSummary(data: AppData): ImportDataSummary {
  return {
    groupCount: data.groups.length,
    itemCount: data.items.length,
    categoryCount: data.categories.length,
  }
}

/**
 * 应用数据导入导出交互流程
 */
export function useAppDataTransfer() {
  const store = useAppDataStore()

  const exporting = ref(false)
  const importing = ref(false)

  /**
   * 导出当前已持久化的数据
   *
   * 从磁盘读取，避免导出尚未保存成功的内存状态。
   */
  async function exportData(): Promise<boolean> {
    if (exporting.value || importing.value || store.saving) return false

    exporting.value = true

    try {
      const data = await appDataRepository.load()

      return await appDataTransferRepository.exportData(data)
    } finally {
      exporting.value = false
    }
  }

  /**
   * 选择文件、校验并整体替换现有数据
   *
   * 返回 false 表示用户取消了文件选择或确认；
   * 文件内容无效或写入失败会以异常形式抛出，且不修改现有数据。
   */
  async function importData(): Promise<boolean> {
    if (importing.value || exporting.value || store.saving) return false

    importing.value = true

    try {
      const data = await appDataTransferRepository.selectImportData()

      if (!data) return false

      const summary = getDataSummary(data)

      try {
        await showConfirmDialog({
          title: '确认导入数据',
          message:
            '文件包含：\n' +
            `${summary.groupCount} 个物品组\n` +
            `${summary.itemCount} 件物品\n` +
            `${summary.categoryCount} 个分类\n\n` +
            '导入将替换应用内的全部现有数据，确定继续吗？',
          confirmButtonText: '确认导入',
          confirmButtonColor: 'var(--van-danger-color)',
          cancelButtonText: '取消',
        })
      } catch {
        // 用户取消确认，不做任何修改。
        return false
      }

      try {
        await store.importData(data)
      } catch (error) {
        throw new DataTransferError(
          'persist-failed',
          'Failed to persist imported data',
          { cause: error },
        )
      }

      return true
    } finally {
      importing.value = false
    }
  }

  return {
    exporting,
    importing,
    exportData,
    importData,
  }
}
