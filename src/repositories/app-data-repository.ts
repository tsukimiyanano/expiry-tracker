import {
  BaseDirectory,
  copyFile,
  exists,
  mkdir,
  readTextFile,
  rename,
  writeTextFile,
} from '@tauri-apps/plugin-fs'

import {
  APP_DATA_BACKUP_FILE_NAME,
  APP_DATA_FILE_NAME,
  APP_DATA_TEMP_FILE_NAME,
  APP_DATA_VERSION,
} from '@/constants/app-data'
import { AsyncUtils } from '@/utils/async'
import { validateAppData } from '@/validators/app-data-validator'

import type { AppData } from '@/types/app-data'

const baseDir = BaseDirectory.AppData

/**
 * 串行执行 Repository 的文件操作。
 *
 * 防止同一运行实例内的读取和写入交叉执行；
 * 单个操作失败不阻塞后续操作。
 */
const operationQueue = AsyncUtils.createSerialQueue()

/**
 * 创建初始空数据
 */
function createEmptyAppData(): AppData {
  return {
    version: APP_DATA_VERSION,
    groups: [],
    items: [],
    categories: [],
  }
}

/**
 * 确保应用数据目录存在。
 */
async function ensureDataDirectory(): Promise<void> {
  await mkdir('.', { baseDir, recursive: true })
}

async function fileExists(name: string): Promise<boolean> {
  return exists(name, { baseDir })
}

/**
 * 读取并校验数据文件。
 */
async function readValidatedFile(name: string): Promise<AppData> {
  const content = await readTextFile(name, { baseDir })
  const parsed: unknown = JSON.parse(content)

  validateAppData(parsed)

  return parsed
}

/**
 * 写入临时文件，并回读校验。
 *
 * 不假定写入一定完整，只有能重新解析并校验通过的内容
 * 才允许用于替换正式文件。
 */
async function writeValidatedTempFile(content: string): Promise<void> {
  await writeTextFile(APP_DATA_TEMP_FILE_NAME, content, { baseDir })

  await readValidatedFile(APP_DATA_TEMP_FILE_NAME)
}

/**
 * 提交一份已序列化的数据。
 *
 * 正式文件在新数据完整准备好之前始终保持不动：
 * 临时文件写入或校验失败时，不会破坏当前正式数据。
 */
async function writeData(content: string): Promise<void> {
  await ensureDataDirectory()

  const hasMainFile = await fileExists(APP_DATA_FILE_NAME)

  if (hasMainFile) {
    try {
      await readValidatedFile(APP_DATA_FILE_NAME)
    } catch {
      // 不允许用新数据覆盖已经损坏的正式文件。
      throw new Error('正式数据文件无效，已停止保存，以避免覆盖原始数据')
    }
  } else {
    // 正式文件缺失但存在备份，可能是异常写入后的中间状态，
    // 不能当作首次安装直接覆盖。
    const hasBackupFile = await fileExists(APP_DATA_BACKUP_FILE_NAME)

    if (hasBackupFile) {
      throw new Error('正式数据文件缺失，但检测到备份，已停止保存')
    }
  }

  await writeValidatedTempFile(content)

  if (hasMainFile) {
    // 更新备份前，正式文件已通过有效性校验。
    await copyFile(APP_DATA_FILE_NAME, APP_DATA_BACKUP_FILE_NAME, {
      fromPathBaseDir: baseDir,
      toPathBaseDir: baseDir,
    })

    await readValidatedFile(APP_DATA_BACKUP_FILE_NAME)
  }

  // 临时文件与正式文件位于同一目录。
  // rename 的替换语义仍受底层操作系统约束。
  await rename(APP_DATA_TEMP_FILE_NAME, APP_DATA_FILE_NAME, {
    oldPathBaseDir: baseDir,
    newPathBaseDir: baseDir,
  })
}

/**
 * 加载应用数据。
 *
 * 首次启动（不存在任何历史文件）时创建初始空数据。
 * 正式文件无效时立即报错并保留现场，不自动使用备份或临时文件覆盖。
 */
async function loadData(): Promise<AppData> {
  await ensureDataDirectory()

  const hasMainFile = await fileExists(APP_DATA_FILE_NAME)

  if (hasMainFile) {
    try {
      return await readValidatedFile(APP_DATA_FILE_NAME)
    } catch {
      const hasBackupFile = await fileExists(APP_DATA_BACKUP_FILE_NAME)

      throw new Error(
        hasBackupFile
          ? '正式数据文件无效，检测到备份文件，请先恢复数据'
          : '正式数据文件无效，且没有检测到备份，请保留原始文件',
      )
    }
  }

  const hasBackupFile = await fileExists(APP_DATA_BACKUP_FILE_NAME)
  const hasTempFile = await fileExists(APP_DATA_TEMP_FILE_NAME)

  // 备份和临时文件都可能代表一次尚未处理完毕的异常写入，
  // 不能按首次启动初始化。
  if (hasBackupFile || hasTempFile) {
    throw new Error('正式数据文件缺失，但检测到历史数据文件，已停止初始化')
  }

  const emptyData = createEmptyAppData()

  await writeData(JSON.stringify(emptyData, null, 2))

  return emptyData
}

/**
 * 应用数据持久化 Repository
 */
export const appDataRepository = {
  /**
   * 加载并验证应用数据
   */
  load(): Promise<AppData> {
    return operationQueue.enqueue(loadData)
  },

  /**
   * 保存完整应用数据
   */
  save(data: AppData): Promise<void> {
    validateAppData(data)

    // 入队前序列化，避免外部继续修改 data
    // 导致保存内容与调用时不一致。
    const content = JSON.stringify(data, null, 2)

    return operationQueue.enqueue(() => writeData(content))
  },
}
