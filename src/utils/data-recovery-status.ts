import type {
  AppDataRecoveryStatus,
  RecoveryFileInfo,
  RecoverySource,
} from '@/types/data-recovery'

export interface RecoveryStatusPresentation {
  label: string
  description: string
  color: 'success' | 'warning' | 'danger' | 'default'
}

/**
 * 候选文件是否允许恢复
 *
 * 与 Repository 的恢复限制保持一致：
 * 主文件有效或无法读取时禁止恢复，避免误覆盖现场。
 */
function canRestore(
  status: AppDataRecoveryStatus,
  source: RecoverySource,
): boolean {
  const candidate = source === 'backup' ? status.backup : status.temp

  return (
    candidate.state === 'valid' &&
    status.main.state !== 'valid' &&
    status.main.state !== 'unreadable'
  )
}

/**
 * 备份检查结果的状态文案与恢复条件
 */
export const DataRecoveryStatusUtils = {
  getFilePresentation(file: RecoveryFileInfo): RecoveryStatusPresentation {
    switch (file.state) {
      case 'valid':
        return {
          label: '正常',
          description: '文件结构和数据关联校验通过',
          color: 'success',
        }

      case 'missing':
        return {
          label: '不存在',
          description: '尚未找到该文件',
          color: 'default',
        }

      case 'invalid':
        return {
          label: '数据损坏',
          description: '文件存在，但内容未通过数据校验',
          color: 'danger',
        }

      case 'unreadable':
        return {
          label: '无法读取',
          description: '文件读取失败，请检查存储访问状态',
          color: 'warning',
        }
    }
  },

  canRestore,

  getRecoveryMessage(status: AppDataRecoveryStatus): string {
    if (status.main.state === 'valid') {
      return '主数据文件正常，无需执行数据恢复。'
    }

    if (status.main.state === 'unreadable') {
      return '主数据文件无法读取。为避免误覆盖数据，当前禁止恢复操作。'
    }

    const hasBackup = canRestore(status, 'backup')
    const hasTemp = canRestore(status, 'temp')

    if (hasBackup && hasTemp) {
      return '主数据文件异常，检测到两个有效的恢复候选文件。请确认数据内容后选择恢复来源。'
    }

    if (hasBackup) {
      return '主数据文件异常，检测到有效备份，可以尝试恢复。'
    }

    if (hasTemp) {
      return '主数据文件异常，检测到有效临时文件，可以尝试恢复。'
    }

    return '当前没有可用的恢复文件，请勿反复尝试覆盖数据。'
  },
}
