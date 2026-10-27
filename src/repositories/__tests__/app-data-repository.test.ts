import { beforeEach, describe, expect, it } from 'vitest'

import {
  APP_DATA_FILE_NAME,
  APP_DATA_MIGRATION_ROLLBACK_FILE_PREFIX,
  APP_DATA_MIGRATION_SNAPSHOT_PREFIX,
  APP_DATA_MIGRATION_TEMP_FILE_PREFIX,
} from '@/constants/app-data'
import { createAppDataRepository } from '@/repositories/app-data-repository'
import { createAppDataV1 } from '@/test/fixtures/app-data'
import { MemoryFileSystem } from '@/test/mocks/memory-file-system'

describe('createAppDataRepository 迁移写回', () => {
  let fs: MemoryFileSystem

  beforeEach(() => {
    fs = new MemoryFileSystem()
  })

  /**
   * 写入一份 V1 主文件并创建 Repository。
   * 返回原始文本，便于断言失败后主文件内容未被改写。
   */
  function setupV1() {
    const original = JSON.stringify(createAppDataV1(), null, 2)

    fs.files.set(APP_DATA_FILE_NAME, original)

    return {
      original,
      repository: createAppDataRepository(fs),
    }
  }

  function listFileNames(prefix: string): string[] {
    return [...fs.files.keys()].filter((name) => name.startsWith(prefix))
  }

  it('启动时将 V1 数据自动迁移为 V2 并写回主文件', async () => {
    const { repository } = setupV1()

    const data = await repository.load()

    expect(data.version).toBe(2)
    expect(data.categories[0].description).toBe('')

    const saved: unknown = JSON.parse(fs.files.get(APP_DATA_FILE_NAME) ?? '')

    expect(saved).toEqual(data)
  })

  it('迁移成功后保留原始 V1 永久快照', async () => {
    const { original, repository } = setupV1()

    await repository.load()

    const snapshots = listFileNames(APP_DATA_MIGRATION_SNAPSHOT_PREFIX)

    expect(snapshots).toHaveLength(1)
    expect(snapshots[0]).toMatch(/\.json$/)
    expect(fs.files.get(snapshots[0])).toBe(original)
  })

  it('再次启动不会重复创建迁移快照', async () => {
    const { repository } = setupV1()

    await repository.load()
    await repository.load()

    expect(listFileNames(APP_DATA_MIGRATION_SNAPSHOT_PREFIX)).toHaveLength(1)
  })

  it('原始数据 JSON 损坏时拒绝加载且不修改主文件', async () => {
    const broken = '{ "version": 1, '
    fs.files.set(APP_DATA_FILE_NAME, broken)

    const repository = createAppDataRepository(fs)

    await expect(repository.load()).rejects.toThrow()

    expect(fs.files.get(APP_DATA_FILE_NAME)).toBe(broken)
    expect(listFileNames(APP_DATA_MIGRATION_SNAPSHOT_PREFIX)).toHaveLength(0)
  })

  it('迁移快照复制失败时主文件保持 V1', async () => {
    const { original, repository } = setupV1()

    fs.failNext({ operation: 'copy', path: APP_DATA_FILE_NAME })

    await expect(repository.load()).rejects.toThrow()

    expect(fs.files.get(APP_DATA_FILE_NAME)).toBe(original)
    expect(listFileNames(APP_DATA_MIGRATION_SNAPSHOT_PREFIX)).toHaveLength(0)
    expect(listFileNames(APP_DATA_MIGRATION_TEMP_FILE_PREFIX)).toHaveLength(0)
  })

  it('迁移暂存文件写入失败时主文件保持 V1', async () => {
    const { original, repository } = setupV1()

    fs.failNext({ operation: 'writeText' })

    await expect(repository.load()).rejects.toThrow()

    expect(fs.files.get(APP_DATA_FILE_NAME)).toBe(original)
    expect(listFileNames(APP_DATA_MIGRATION_TEMP_FILE_PREFIX)).toHaveLength(0)
  })

  it('替换主文件失败时自动回滚为原始 V1', async () => {
    const { original, repository } = setupV1()

    // 第二次 rename 对应「暂存文件 → 主文件」。
    fs.failNext({ operation: 'rename', occurrence: 2 })

    await expect(repository.load()).rejects.toThrow()

    expect(fs.files.get(APP_DATA_FILE_NAME)).toBe(original)
    expect(listFileNames(APP_DATA_MIGRATION_ROLLBACK_FILE_PREFIX)).toHaveLength(
      0,
    )
  })

  it('回滚也失败时保留原始数据且禁止空数据初始化', async () => {
    const { original, repository } = setupV1()

    // 第二次 rename 失败触发回滚，第三次 rename（回滚）也随之失败。
    fs.failNext({ operation: 'rename', occurrence: 2 })
    fs.failNext({ operation: 'rename', occurrence: 3 })

    await expect(repository.load()).rejects.toThrow('自动回滚也失败')

    expect(fs.files.has(APP_DATA_FILE_NAME)).toBe(false)

    const rollbackFiles = listFileNames(APP_DATA_MIGRATION_ROLLBACK_FILE_PREFIX)

    expect(rollbackFiles).toHaveLength(1)
    expect(fs.files.get(rollbackFiles[0])).toBe(original)

    // 再次启动时主文件缺失但存在迁移残留文件，不能被当作首次安装。
    await expect(repository.load()).rejects.toThrow('已停止初始化')

    expect(fs.files.has(APP_DATA_FILE_NAME)).toBe(false)
  })
})
