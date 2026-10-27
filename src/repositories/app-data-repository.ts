import {
  APP_DATA_BACKUP_FILE_NAME,
  APP_DATA_FILE_NAME,
  APP_DATA_IMPORT_SNAPSHOT_PREFIX,
  APP_DATA_IMPORT_SNAPSHOT_TEMP_FILE_NAME,
  APP_DATA_MIGRATION_FAILED_FILE_PREFIX,
  APP_DATA_MIGRATION_ROLLBACK_FILE_PREFIX,
  APP_DATA_MIGRATION_SNAPSHOT_PREFIX,
  APP_DATA_MIGRATION_TEMP_FILE_PREFIX,
  APP_DATA_RESTORE_TEMP_FILE_NAME,
  APP_DATA_TEMP_FILE_NAME,
  APP_DATA_VERSION,
} from '@/constants/app-data'
import { migrateAppData } from '@/migrations/app-data-migrator'
import {
  tauriAppDataFileSystem,
  type AppDataFileSystem,
} from '@/repositories/app-data-file-system'
import { AsyncUtils } from '@/utils/async'
import { DataTransferError } from '@/utils/data-transfer-error'
import { ErrorUtils } from '@/utils/error'
import { validateAppData } from '@/validators/app-data-validator'

import type { AppData } from '@/types/app-data'
import type {
  AppDataRecoveryStatus,
  RecoveryFileInfo,
  RecoverySource,
} from '@/types/data-recovery'

/**
 * 创建应用数据持久化 Repository
 *
 * 文件系统通过参数注入，生产环境使用 Tauri FS，
 * 测试可注入内存文件系统以验证失败与回滚路径。
 */
export function createAppDataRepository(fs: AppDataFileSystem) {
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
    await fs.mkdir('.')
  }

  function pad2(value: number): string {
    return String(value).padStart(2, '0')
  }

  /**
   * 生成带本地时间戳的导入前快照文件名。
   */
  function createImportSnapshotFileName(): string {
    const now = new Date()
    const date = `${now.getFullYear()}${pad2(now.getMonth() + 1)}${pad2(now.getDate())}`
    const time = `${pad2(now.getHours())}${pad2(now.getMinutes())}${pad2(now.getSeconds())}`

    return `${APP_DATA_IMPORT_SNAPSHOT_PREFIX}${date}-${time}`
  }

  function isImportSnapshotFileName(name: string): boolean {
    if (!name.startsWith(APP_DATA_IMPORT_SNAPSHOT_PREFIX)) return false

    return /^\d{8}-\d{6}$/.test(
      name.slice(APP_DATA_IMPORT_SNAPSHOT_PREFIX.length),
    )
  }

  /**
   * 列出所有导入前快照文件名，按文件名倒序（新的在前）。
   */
  async function listImportSnapshotFileNames(): Promise<string[]> {
    const entries = await fs.readDir('.')

    return entries
      .filter(isImportSnapshotFileName)
      .sort((a, b) => b.localeCompare(a))
  }

  async function findLatestImportSnapshotFileName(): Promise<string | null> {
    const fileNames = await listImportSnapshotFileNames()

    return fileNames[0] ?? null
  }

  function isMigrationSnapshotFileName(name: string): boolean {
    return (
      name.startsWith(APP_DATA_MIGRATION_SNAPSHOT_PREFIX) &&
      name.endsWith('.json')
    )
  }

  /**
   * 列出所有迁移前保护快照文件名，按文件名倒序（较新的版本在前）。
   */
  async function listMigrationSnapshotFileNames(): Promise<string[]> {
    const entries = await fs.readDir('.')

    return entries
      .filter(isMigrationSnapshotFileName)
      .sort((a, b) => b.localeCompare(a))
  }

  async function findLatestMigrationSnapshotFileName(): Promise<string | null> {
    const fileNames = await listMigrationSnapshotFileNames()

    return fileNames[0] ?? null
  }

  const MIGRATION_FILE_PREFIXES = [
    APP_DATA_MIGRATION_SNAPSHOT_PREFIX,
    APP_DATA_MIGRATION_TEMP_FILE_PREFIX,
    APP_DATA_MIGRATION_ROLLBACK_FILE_PREFIX,
    APP_DATA_MIGRATION_FAILED_FILE_PREFIX,
  ]

  /**
   * 是否存在迁移过程残留文件。
   *
   * 迁移被系统终止时可能留下这些文件而正式文件已缺失，
   * 此时不能按首次安装初始化。
   */
  async function hasMigrationResidue(): Promise<boolean> {
    const entries = await fs.readDir('.')

    return entries.some((name) =>
      MIGRATION_FILE_PREFIXES.some((prefix) => name.startsWith(prefix)),
    )
  }

  /**
   * 读取并校验当前版本的数据文件。
   *
   * 用于临时文件回读、备份文件校验与恢复暂存文件校验。
   */
  async function readValidatedFile(name: string): Promise<AppData> {
    const content = await fs.readText(name)
    const parsed: unknown = JSON.parse(content)

    validateAppData(parsed)

    return parsed
  }

  /**
   * 读取数据文件并迁移至当前版本。
   *
   * 用于从磁盘加载正式数据，以及迁移后确认主文件内容。
   */
  async function readMigratedFile(name: string): Promise<AppData> {
    const content = await fs.readText(name)
    const parsed: unknown = JSON.parse(content)

    return migrateAppData(parsed).data
  }

  /**
   * 写入临时文件，并回读校验。
   *
   * 不假定写入一定完整，只有能重新解析并校验通过的内容
   * 才允许用于替换正式文件。
   */
  async function writeValidatedTempFile(content: string): Promise<void> {
    await fs.writeText(APP_DATA_TEMP_FILE_NAME, content)

    await readValidatedFile(APP_DATA_TEMP_FILE_NAME)
  }

  /**
   * 写入导入前快照，并清理旧的快照文件。
   *
   * 新快照完整写入并回读校验后才重命名为时间戳文件；
   * 任一步失败都不会影响已有的快照文件。
   */
  async function writeImportSnapshot(content: string): Promise<void> {
    const fileName = createImportSnapshotFileName()

    try {
      await ensureDataDirectory()

      await fs.writeText(APP_DATA_IMPORT_SNAPSHOT_TEMP_FILE_NAME, content)

      await readValidatedFile(APP_DATA_IMPORT_SNAPSHOT_TEMP_FILE_NAME)

      await fs.rename(APP_DATA_IMPORT_SNAPSHOT_TEMP_FILE_NAME, fileName)
    } catch (cause) {
      throw new DataTransferError(
        'snapshot-failed',
        'Failed to create import snapshot',
        { cause },
      )
    }

    // 单份保留：删除其它快照。清理失败不影响本次导入。
    try {
      const fileNames = await listImportSnapshotFileNames()

      await Promise.all(
        fileNames
          .filter((name) => name !== fileName)
          .map((name) => fs.remove(name).catch(() => undefined)),
      )
    } catch {
      // 忽略清理异常，下次导入时会再次尝试。
    }
  }

  /**
   * 提交一份已序列化的数据。
   *
   * 正式文件在新数据完整准备好之前始终保持不动：
   * 临时文件写入或校验失败时，不会破坏当前正式数据。
   */
  async function writeData(content: string): Promise<void> {
    await ensureDataDirectory()

    const hasMainFile = await fs.exists(APP_DATA_FILE_NAME)

    if (hasMainFile) {
      try {
        await readValidatedFile(APP_DATA_FILE_NAME)
      } catch {
        // 不允许用新数据覆盖已经损坏的正式文件。
        throw new Error('正式数据文件无效，已停止保存，以避免覆盖原始数据')
      }
    } else {
      // 正式文件缺失但存在历史文件，可能是异常写入后的中间状态，
      // 不能当作首次安装直接覆盖。
      const hasBackupFile = await fs.exists(APP_DATA_BACKUP_FILE_NAME)
      const hasImportSnapshot =
        (await findLatestImportSnapshotFileName()) !== null
      const hasMigrationFiles = await hasMigrationResidue()

      if (hasBackupFile || hasImportSnapshot || hasMigrationFiles) {
        throw new Error(
          '正式数据文件缺失，但检测到备份、导入前快照或迁移过程文件，已停止保存',
        )
      }
    }

    await writeValidatedTempFile(content)

    if (hasMainFile) {
      // 更新备份前，正式文件已通过有效性校验。
      await fs.copy(APP_DATA_FILE_NAME, APP_DATA_BACKUP_FILE_NAME)

      await readValidatedFile(APP_DATA_BACKUP_FILE_NAME)
    }

    // 临时文件与正式文件位于同一目录。
    // rename 的替换语义仍受底层操作系统约束。
    await fs.rename(APP_DATA_TEMP_FILE_NAME, APP_DATA_FILE_NAME)
  }

  /**
   * 迁移事务：永久保留原始数据，安全写入当前版本数据。
   *
   * 必须在 Repository 串行队列内部调用，不得再调用 load()/save()。
   * 任何一步失败都不能让原始数据被新数据覆盖。
   */
  async function persistMigratedData(
    originalText: string,
    migratedData: AppData,
    sourceVersion: number,
  ): Promise<void> {
    validateAppData(migratedData)

    const id = crypto.randomUUID()

    const snapshotFileName = `${APP_DATA_MIGRATION_SNAPSHOT_PREFIX}v${sourceVersion}-${id}.json`
    const stageFileName = `${APP_DATA_MIGRATION_TEMP_FILE_PREFIX}${id}.tmp`
    const rollbackFileName = `${APP_DATA_MIGRATION_ROLLBACK_FILE_PREFIX}${id}`
    const failedFileName = `${APP_DATA_MIGRATION_FAILED_FILE_PREFIX}${id}`

    const occupied = await Promise.all([
      fs.exists(snapshotFileName),
      fs.exists(stageFileName),
      fs.exists(rollbackFileName),
      fs.exists(failedFileName),
    ])

    if (occupied.some(Boolean)) {
      throw new Error('迁移保护文件已存在，已中止迁移')
    }

    // 再次核对主文件，防止基于陈旧内容执行迁移。
    const currentText = await fs.readText(APP_DATA_FILE_NAME)

    if (currentText !== originalText) {
      throw new Error('迁移期间主数据文件发生变化，已中止迁移')
    }

    // 1. 永久保留原始旧版本数据，并回读确认内容一致。
    await fs.copy(APP_DATA_FILE_NAME, snapshotFileName)

    const snapshotText = await fs.readText(snapshotFileName)

    if (snapshotText !== originalText) {
      throw new Error('迁移保护快照校验失败，已中止迁移')
    }

    // 2. 写入迁移后的数据，并回读校验为当前版本。
    await fs.writeText(stageFileName, JSON.stringify(migratedData, null, 2))

    await readValidatedFile(stageFileName)

    // 3. 替换前再次确认主文件未被修改。
    const latestText = await fs.readText(APP_DATA_FILE_NAME)

    if (latestText !== originalText) {
      throw new Error('主文件在迁移期间被修改，已中止替换')
    }

    // 4. 替换主数据文件，失败时尽力回滚。
    let oldFileMoved = false
    let newFileMoved = false

    try {
      await fs.rename(APP_DATA_FILE_NAME, rollbackFileName)
      oldFileMoved = true

      await fs.rename(stageFileName, APP_DATA_FILE_NAME)
      newFileMoved = true

      await readMigratedFile(APP_DATA_FILE_NAME)
    } catch (cause) {
      if (oldFileMoved) {
        try {
          // 不直接覆盖已有回滚文件：先移开未确认的新文件。
          if (newFileMoved) {
            await fs.rename(APP_DATA_FILE_NAME, failedFileName)
          }

          await fs.rename(rollbackFileName, APP_DATA_FILE_NAME)
        } catch (rollbackCause) {
          throw new Error(
            '数据迁移失败，自动回滚也失败。请保留现有文件并执行恢复检查。' +
              `（迁移错误：${ErrorUtils.getMessage(cause)}；` +
              `回滚错误：${ErrorUtils.getMessage(rollbackCause)}）`,
            { cause },
          )
        }
      }

      throw cause
    }

    // 5. 主文件已确认可用，清理迁移过程文件。
    // 清理失败不影响迁移结果，永久保护快照始终保留。
    try {
      if (await fs.exists(rollbackFileName)) {
        await fs.remove(rollbackFileName)
      }

      if (await fs.exists(stageFileName)) {
        await fs.remove(stageFileName)
      }
    } catch {
      // 留待后续文件维护流程处理。
    }
  }

  /**
   * 加载已存在的正式数据，必要时执行自动迁移写回。
   */
  async function loadExistingData(): Promise<AppData> {
    const originalText = await fs.readText(APP_DATA_FILE_NAME)
    const parsed: unknown = JSON.parse(originalText)
    const result = migrateAppData(parsed)

    if (!result.migrated) {
      return result.data
    }

    await persistMigratedData(originalText, result.data, result.sourceVersion)

    return result.data
  }

  /**
   * 加载应用数据。
   *
   * 首次启动（不存在任何历史文件）时创建初始空数据。
   * 正式文件无效时立即报错并保留现场，不自动使用备份或临时文件覆盖。
   */
  async function loadData(): Promise<AppData> {
    await ensureDataDirectory()

    const hasMainFile = await fs.exists(APP_DATA_FILE_NAME)

    if (hasMainFile) {
      try {
        return await loadExistingData()
      } catch (cause) {
        const hasBackupFile = await fs.exists(APP_DATA_BACKUP_FILE_NAME)

        throw new Error(
          hasBackupFile
            ? `数据读取或版本迁移失败，检测到备份文件，请先恢复数据：${ErrorUtils.getMessage(cause)}`
            : `数据读取或版本迁移失败，且没有检测到备份，请保留原始文件：${ErrorUtils.getMessage(cause)}`,
          { cause },
        )
      }
    }

    const hasBackupFile = await fs.exists(APP_DATA_BACKUP_FILE_NAME)
    const hasTempFile = await fs.exists(APP_DATA_TEMP_FILE_NAME)
    const hasImportSnapshot =
      (await findLatestImportSnapshotFileName()) !== null
    const hasMigrationFiles = await hasMigrationResidue()

    // 备份、临时文件、导入前快照和迁移过程文件都可能代表历史数据，
    // 不能按首次启动初始化。
    if (
      hasBackupFile ||
      hasTempFile ||
      hasImportSnapshot ||
      hasMigrationFiles
    ) {
      throw new Error('正式数据文件缺失，但检测到历史数据文件，已停止初始化')
    }

    const emptyData = createEmptyAppData()

    await writeData(JSON.stringify(emptyData, null, 2))

    return emptyData
  }

  /**
   * 检查单个数据文件的状态。
   *
   * 旧版本数据会校验并迁移后参与判断，合法的 V1 文件不会被当作损坏；
   * unreadable 表示文件存在但读取失败，两者不能混淆。
   */
  async function inspectRecoveryFile(
    fileName: string,
  ): Promise<RecoveryFileInfo> {
    try {
      // exists() 本身可能因存储访问异常而失败，
      // 不能把它误判为文件不存在。
      if (!(await fs.exists(fileName))) {
        return {
          fileName,
          state: 'missing',
        }
      }

      let content: string

      try {
        content = await fs.readText(fileName)
      } catch (cause) {
        return {
          fileName,
          state: 'unreadable',
          error: ErrorUtils.getMessage(cause),
        }
      }

      try {
        const parsed: unknown = JSON.parse(content)
        const { data } = migrateAppData(parsed)

        return {
          fileName,
          state: 'valid',
          summary: {
            groupCount: data.groups.length,
            itemCount: data.items.length,
            categoryCount: data.categories.length,
          },
        }
      } catch (cause) {
        return {
          fileName,
          state: 'invalid',
          error: ErrorUtils.getMessage(cause),
        }
      }
    } catch (cause) {
      return {
        fileName,
        state: 'unreadable',
        error: ErrorUtils.getMessage(cause),
      }
    }
  }

  /**
   * 检查最近一次导入前快照的状态。
   *
   * 快照文件名带时间戳，需要按目录中的最新文件定位；
   * 目录读取失败时单独标记为无法读取，不影响其它文件的状态。
   */
  async function inspectImportSnapshotFile(): Promise<RecoveryFileInfo> {
    const displayName = `${APP_DATA_IMPORT_SNAPSHOT_PREFIX}*`

    try {
      const fileName = await findLatestImportSnapshotFileName()

      if (!fileName) {
        return {
          fileName: displayName,
          state: 'missing',
        }
      }

      return await inspectRecoveryFile(fileName)
    } catch (cause) {
      return {
        fileName: displayName,
        state: 'unreadable',
        error: ErrorUtils.getMessage(cause),
      }
    }
  }

  /**
   * 检查最近一次迁移前保护快照的状态。
   */
  async function inspectMigrationSnapshotFile(): Promise<RecoveryFileInfo> {
    const displayName = `${APP_DATA_MIGRATION_SNAPSHOT_PREFIX}*`

    try {
      const fileName = await findLatestMigrationSnapshotFileName()

      if (!fileName) {
        return {
          fileName: displayName,
          state: 'missing',
        }
      }

      return await inspectRecoveryFile(fileName)
    } catch (cause) {
      return {
        fileName: displayName,
        state: 'unreadable',
        error: ErrorUtils.getMessage(cause),
      }
    }
  }

  /**
   * 检查正式文件、备份文件、临时文件、导入前快照与迁移前快照的状态。
   */
  async function inspectRecoveryData(): Promise<AppDataRecoveryStatus> {
    await ensureDataDirectory()

    const [main, backup, temp, importSnapshot, migrationSnapshot] =
      await Promise.all([
        inspectRecoveryFile(APP_DATA_FILE_NAME),
        inspectRecoveryFile(APP_DATA_BACKUP_FILE_NAME),
        inspectRecoveryFile(APP_DATA_TEMP_FILE_NAME),
        inspectImportSnapshotFile(),
        inspectMigrationSnapshotFile(),
      ])

    return { main, backup, temp, importSnapshot, migrationSnapshot }
  }

  /**
   * 使用指定候选文件恢复正式数据。
   *
   * 恢复前保留损坏现场，候选文件通过校验后才替换正式文件；
   * 任何一步失败都不会删除候选文件，便于再次尝试。
   */
  async function restoreData(source: RecoverySource): Promise<void> {
    const status = await inspectRecoveryData()

    if (status.main.state === 'unreadable') {
      throw new Error(
        '正式数据文件无法读取，暂时不能安全恢复。请先检查文件访问权限',
      )
    }

    // 备份和临时文件不允许覆盖有效的正式文件；
    // 导入前快照与迁移前快照是例外，用于撤销导入或迁移。
    const isSnapshotSource =
      source === 'import-snapshot' || source === 'migration-snapshot'

    if (!isSnapshotSource && status.main.state === 'valid') {
      throw new Error('当前正式数据文件有效，只能使用快照撤销导入或迁移')
    }

    const candidate =
      source === 'backup'
        ? status.backup
        : source === 'temp'
          ? status.temp
          : source === 'import-snapshot'
            ? status.importSnapshot
            : status.migrationSnapshot

    if (candidate.state !== 'valid') {
      throw new Error('所选恢复文件不存在或未通过数据校验，请重新检查恢复状态')
    }

    const sourceFileName =
      source === 'backup'
        ? APP_DATA_BACKUP_FILE_NAME
        : source === 'temp'
          ? APP_DATA_TEMP_FILE_NAME
          : candidate.fileName

    await ensureDataDirectory()

    // 候选文件可能是旧版本，必须先迁移成当前版本再写入。
    let restoredData: AppData

    try {
      const candidateText = await fs.readText(sourceFileName)
      const parsed: unknown = JSON.parse(candidateText)

      restoredData = migrateAppData(parsed).data
    } catch (cause) {
      throw new Error(
        '所选恢复文件不存在或未通过数据校验，请重新检查恢复状态',
        {
          cause,
        },
      )
    }

    // 先准备恢复暂存文件，不动现有正式文件。
    await fs.writeText(
      APP_DATA_RESTORE_TEMP_FILE_NAME,
      JSON.stringify(restoredData, null, 2),
    )

    // 写入后再次检查，防止将无效数据提交为正式数据。
    await readValidatedFile(APP_DATA_RESTORE_TEMP_FILE_NAME)

    const mainExists = await fs.exists(APP_DATA_FILE_NAME)

    if (mainExists) {
      // 保留损坏现场；不覆盖之前留下的任何现场文件。
      const quarantineFileName = `${APP_DATA_FILE_NAME}.corrupt-${Date.now()}`

      await fs.copy(APP_DATA_FILE_NAME, quarantineFileName)

      // 主文件若存在，必须先删除；删除失败则不继续。
      await fs.remove(APP_DATA_FILE_NAME)
    }

    await fs.rename(APP_DATA_RESTORE_TEMP_FILE_NAME, APP_DATA_FILE_NAME)

    // 最后验证正式文件。备份和原候选文件均不删除。
    await readValidatedFile(APP_DATA_FILE_NAME)
  }

  return {
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
     * 保存导入前快照
     *
     * 在导入写入新数据之前调用，快照不参与日常保存的滚动备份。
     */
    saveImportSnapshot(data: AppData): Promise<void> {
      validateAppData(data)

      const content = JSON.stringify(data, null, 2)

      return operationQueue.enqueue(() => writeImportSnapshot(content))
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
}

/**
 * 应用数据持久化 Repository（生产实例）
 */
export const appDataRepository = createAppDataRepository(tauriAppDataFileSystem)
