import { APP_DATA_VERSION } from '@/constants/app-data'
import type { AppData } from '@/types/app-data'
import { ObjectUtils } from '@/utils/object'
import { validateAppData } from '@/validators/app-data-validator'

export interface AppDataMigrationResult {
  data: AppData
  sourceVersion: number
  targetVersion: number
  migrated: boolean
}

/**
 * 读取应用数据版本号。
 *
 * 只接受大于等于 1 的安全整数，其余情况视为无效版本。
 */
function getDataVersion(value: unknown): number {
  if (!ObjectUtils.isRecord(value)) {
    throw new Error('应用数据格式错误：根节点必须是对象')
  }

  const version = value.version

  if (
    typeof version !== 'number' ||
    !Number.isSafeInteger(version) ||
    version < 1
  ) {
    throw new Error('应用数据版本无效')
  }

  return version
}

/**
 * 解析并迁移应用数据至当前支持的版本。
 *
 * 不修改输入，不执行文件 IO。
 * 仅返回通过校验的数据。
 */
export function migrateAppData(value: unknown): AppDataMigrationResult {
  const sourceVersion = getDataVersion(value)

  if (sourceVersion > APP_DATA_VERSION) {
    throw new Error(
      `数据版本 V${sourceVersion} 高于当前应用支持的 V${APP_DATA_VERSION}，请升级应用后重试`,
    )
  }

  switch (sourceVersion) {
    case 1: {
      validateAppData(value)

      return {
        data: value,
        sourceVersion,
        targetVersion: APP_DATA_VERSION,
        migrated: false,
      }
    }

    default:
      throw new Error(`不支持的数据版本：V${sourceVersion}`)
  }
}
