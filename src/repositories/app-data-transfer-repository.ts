import { open, save } from '@tauri-apps/plugin-dialog'
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs'

import type { AppData } from '@/types/app-data'
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

    const path = await save({
      defaultPath: createExportFileName(),
      filters: JSON_FILE_FILTER,
    })

    if (!path) return false

    await writeTextFile(path, JSON.stringify(data, null, 2))

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

    // multiple 为 false 时只会返回单个路径，这里仍做防御性判断。
    if (!selected || Array.isArray(selected)) return null

    const content = await readTextFile(selected)
    const parsed: unknown = JSON.parse(content)

    validateAppData(parsed)

    return parsed
  },
}
