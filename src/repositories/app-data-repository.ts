import {
  BaseDirectory,
  copyFile,
  exists,
  mkdir,
  readTextFile,
  remove,
  rename,
  writeTextFile,
} from '@tauri-apps/plugin-fs'

import {
  APP_DATA_BACKUP_FILE_NAME,
  APP_DATA_FILE_NAME,
  APP_DATA_RESTORE_TEMP_FILE_NAME,
  APP_DATA_TEMP_FILE_NAME,
  APP_DATA_VERSION,
} from '@/constants/app-data'
import { AsyncUtils } from '@/utils/async'
import { ErrorUtils } from '@/utils/error'
import { validateAppData } from '@/validators/app-data-validator'

import type { AppData } from '@/types/app-data'
import type {
  AppDataRecoveryStatus,
  RecoveryFileInfo,
  RecoverySource,
} from '@/types/data-recovery'

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
 * 检查单个数据文件的状态。
 *
 * invalid 表示内容不是合法 JSON 或不符合数据结构；
 * unreadable 表示文件存在但读取失败，两者不能混淆。
 */
async function inspectRecoveryFile(
  fileName: string,
): Promise<RecoveryFileInfo> {
  if (!(await fileExists(fileName))) {
    return {
      fileName,
      state: 'missing',
    }
  }

  let content: string

  try {
    content = await readTextFile(fileName, { baseDir })
  } catch (cause) {
    return {
      fileName,
      state: 'unreadable',
      error: ErrorUtils.getMessage(cause),
    }
  }

  let parsed: unknown

  try {
    parsed = JSON.parse(content)
  } catch (cause) {
    return {
      fileName,
      state: 'invalid',
      error: ErrorUtils.getMessage(cause),
    }
  }

  try {
    validateAppData(parsed)
  } catch (cause) {
    return {
      fileName,
      state: 'invalid',
      error: ErrorUtils.getMessage(cause),
    }
  }

  return {
    fileName,
    state: 'valid',
    summary: {
      groupCount: parsed.groups.length,
      itemCount: parsed.items.length,
      categoryCount: parsed.categories.length,
    },
  }
}

/**
 * 检查正式文件、备份文件和临时文件的状态。
 */
async function inspectRecoveryData(): Promise<AppDataRecoveryStatus> {
  await ensureDataDirectory()

  const [main, backup, temp] = await Promise.all([
    inspectRecoveryFile(APP_DATA_FILE_NAME),
    inspectRecoveryFile(APP_DATA_BACKUP_FILE_NAME),
    inspectRecoveryFile(APP_DATA_TEMP_FILE_NAME),
  ])

  return { main, backup, temp }
}

/**
 * 使用指定候选文件恢复正式数据。
 *
 * 恢复前保留损坏现场，候选文件通过校验后才替换正式文件；
 * 任何一步失败都不会删除候选文件，便于再次尝试。
 */
async function restoreData(source: RecoverySource): Promise<void> {
  const status = await inspectRecoveryData()

  if (status.main.state === 'valid') {
    throw new Error('当前正式数据文件有效，无需执行数据恢复')
  }

  if (status.main.state === 'unreadable') {
    throw new Error(
      '正式数据文件无法读取，暂时不能安全恢复。请先检查文件访问权限',
    )
  }

  const candidate = source === 'backup' ? status.backup : status.temp

  if (candidate.state !== 'valid') {
    throw new Error('所选恢复文件不存在或未通过数据校验，请重新检查恢复状态')
  }

  const sourceFileName =
    source === 'backup' ? APP_DATA_BACKUP_FILE_NAME : APP_DATA_TEMP_FILE_NAME

  await ensureDataDirectory()

  // 先准备恢复暂存文件，不动现有正式文件。
  await copyFile(sourceFileName, APP_DATA_RESTORE_TEMP_FILE_NAME, {
    fromPathBaseDir: baseDir,
    toPathBaseDir: baseDir,
  })

  // 复制后再次检查，防止将无效数据提交为正式数据。
  await readValidatedFile(APP_DATA_RESTORE_TEMP_FILE_NAME)

  const mainExists = await fileExists(APP_DATA_FILE_NAME)

  if (mainExists) {
    // 保留损坏现场；不覆盖之前留下的任何现场文件。
    const quarantineFileName = `${APP_DATA_FILE_NAME}.corrupt-${Date.now()}`

    await copyFile(APP_DATA_FILE_NAME, quarantineFileName, {
      fromPathBaseDir: baseDir,
      toPathBaseDir: baseDir,
    })

    // 主文件若存在，必须先删除；删除失败则不继续。
    await remove(APP_DATA_FILE_NAME, { baseDir })
  }

  await rename(APP_DATA_RESTORE_TEMP_FILE_NAME, APP_DATA_FILE_NAME, {
    oldPathBaseDir: baseDir,
    newPathBaseDir: baseDir,
  })

  // 最后验证正式文件。备份和原候选文件均不删除。
  await readValidatedFile(APP_DATA_FILE_NAME)
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

  /**
   * 检查正式文件与恢复候选文件的状态
   */
  getRecoveryStatus(): Promise<AppDataRecoveryStatus> {
    return operationQueue.enqueue(inspectRecoveryData)
  },

  /**
   * 使用指定候选文件恢复正式数据
   */
  restoreFromRecovery(source: RecoverySource): Promise<void> {
    return operationQueue.enqueue(() => restoreData(source))
  },
}
