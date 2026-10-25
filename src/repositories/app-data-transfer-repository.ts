import { open, save } from '@tauri-apps/plugin-dialog'
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs'

import type { AppData } from '@/types/app-data'
import { DataTransferError } from '@/utils/data-transfer-error'
import { validateAppData } from '@/validators/app-data-validator'

const JSON_FILE_FILTER = [
  {
    name: 'JSON',
    extensions: ['json'],
  },
]

/**
 * 生成默认导出文件名
 */
function createExportFileName(): string {
  const date = new Date()
  const datePart = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')

  return `expiry-tracker-${datePart}.json`
}

/**
 * 应用数据导入导出 Repository
 *
 * 只处理应用目录之外的文件读写；应用内部数据持久化
 * 仍由 app-data-repository.ts 负责。
 */
export const appDataTransferRepository = {
  /**
   * 导出数据到用户选择的文件
   *
   * 返回 false 表示用户取消了文件选择；
   * 实际写入失败会以异常形式抛出。
   */
  async exportData(data: AppData): Promise<boolean> {
    validateAppData(data)

    // 不捕获文件选择器本身的异常：只有返回 null 才表示用户取消。
    const path = await save({
      defaultPath: createExportFileName(),
      filters: JSON_FILE_FILTER,
    })

    if (path === null) return false

    try {
      await writeTextFile(path, JSON.stringify(data, null, 2))
    } catch (error) {
      throw new DataTransferError(
        'write-failed',
        'Failed to write exported data',
        {
          cause: error,
        },
      )
    }

    return true
  },

  /**
   * 读取用户选择的导入文件
   *
   * 返回 null 表示用户取消了文件选择；
   * 文件内容未通过校验时抛出异常，不返回部分数据。
   */
  async selectImportData(): Promise<AppData | null> {
    const selected = await open({
      multiple: false,
      directory: false,
      filters: JSON_FILE_FILTER,
    })

    if (selected === null) return null

    let content: string

    try {
      content = await readTextFile(selected)
    } catch (error) {
      throw new DataTransferError('read-failed', 'Failed to read import file', {
        cause: error,
      })
    }

    let parsed: unknown

    try {
      parsed = JSON.parse(content)
    } catch (error) {
      throw new DataTransferError('invalid-json', 'Invalid JSON format', {
        cause: error,
      })
    }

    try {
      validateAppData(parsed)
    } catch (error) {
      throw new DataTransferError('invalid-data', 'Invalid application data', {
        cause: error,
      })
    }

    return parsed
  },
}
