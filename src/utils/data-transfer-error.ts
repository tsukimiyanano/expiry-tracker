export type DataTransferErrorCode =
  | 'invalid-json'
  | 'invalid-data'
  | 'read-failed'
  | 'write-failed'
  | 'snapshot-failed'
  | 'persist-failed'

/**
 * 导入导出流程中的可分类错误
 *
 * 通过 cause 保留底层异常，便于后续排查；
 * 面向用户的提示由 getDataTransferErrorInfo() 统一提供。
 */
export class DataTransferError extends Error {
  constructor(
    readonly code: DataTransferErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = 'DataTransferError'
  }
}

export interface DataTransferErrorInfo {
  title: string
  message: string
  suggestion: string
}

const ERROR_INFO: Record<DataTransferErrorCode, DataTransferErrorInfo> = {
  'invalid-json': {
    title: '文件格式错误',
    message: '所选文件不是有效的 JSON 文件。',
    suggestion: '请重新选择由本应用导出的完整数据文件。',
  },
  'invalid-data': {
    title: '数据校验失败',
    message: '文件中的数据结构、版本或关联关系不符合当前应用要求。',
    suggestion: '请确认文件来自兼容版本的应用，并且没有被手动修改。',
  },
  'read-failed': {
    title: '文件读取失败',
    message: '无法读取所选文件。',
    suggestion: '请检查文件是否仍然存在，或尝试复制到其他位置后重新导入。',
  },
  'write-failed': {
    title: '数据导出失败',
    message: '无法将数据写入所选位置。',
    suggestion: '请检查设备剩余空间，或选择其他保存位置重试。',
  },
  'persist-failed': {
    title: '数据导入未完成',
    message: '导入文件已通过校验，但应用内部保存数据时发生错误。',
    suggestion: '请先检查当前数据状态，必要时使用备份检查与恢复功能。',
  },
  'snapshot-failed': {
    title: '无法创建导入前备份',
    message: '导入尚未开始，当前数据保持不变。',
    suggestion: '请检查设备剩余空间与存储权限后重试。',
  },
}

/**
 * 将异常转换为用户可理解、可行动的提示
 */
export function getDataTransferErrorInfo(
  error: unknown,
): DataTransferErrorInfo {
  if (error instanceof DataTransferError) {
    return ERROR_INFO[error.code]
  }

  return {
    title: '操作失败',
    message: '执行数据操作时发生了未知错误。',
    suggestion: '请重试；如果问题持续出现，请检查应用数据和备份状态。',
  }
}
