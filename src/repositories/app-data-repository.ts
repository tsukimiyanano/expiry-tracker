import {
  BaseDirectory,
  exists,
  readTextFile,
  writeTextFile,
} from '@tauri-apps/plugin-fs'

import { APP_DATA_FILE_NAME, APP_DATA_VERSION } from '@/constants/app-data'

import type { AppData } from '@/types/app-data'
import { validateAppData } from '@/validators/app-data-validator'

const FILE_OPTIONS = {
  baseDir: BaseDirectory.AppData,
} as const

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
 * 串行执行 Repository 的文件操作。
 *
 * 防止同一运行实例内的读取和写入交叉执行。
 */
let operationQueue: Promise<void> = Promise.resolve()

function enqueueOperation<T>(operation: () => Promise<T>): Promise<T> {
  const task = operationQueue.then(operation)

  operationQueue = task.then(
    () => undefined,
    () => undefined,
  )

  return task
}

/**
 * 读取应用数据。
 *
 * 首次读取时创建默认数据文件。
 * 已存在的数据文件不合法时直接报错，不覆盖原文件。
 */
async function readAppData(): Promise<AppData> {
  const fileExists = await exists(APP_DATA_FILE_NAME, FILE_OPTIONS)

  if (!fileExists) {
    const initialData = createEmptyAppData()

    await writeTextFile(
      APP_DATA_FILE_NAME,
      JSON.stringify(initialData, null, 2),
      FILE_OPTIONS,
    )

    return initialData
  }

  const content = await readTextFile(APP_DATA_FILE_NAME, FILE_OPTIONS)

  let parsed: unknown

  try {
    parsed = JSON.parse(content)
  } catch {
    throw new Error('应用数据文件不是有效的 JSON')
  }

  validateAppData(parsed)

  return parsed
}

/**
 * 应用数据持久化 Repository
 */
export const appDataRepository = {
  /**
   * 加载并验证应用数据
   */
  load(): Promise<AppData> {
    return enqueueOperation(readAppData)
  },

  /**
   * 保存完整应用数据
   */
  save(data: AppData): Promise<void> {
    validateAppData(data)

    // 入队前序列化，避免外部继续修改 data
    // 导致保存内容与调用时不一致。
    const content = JSON.stringify(data, null, 2)

    return enqueueOperation(() =>
      writeTextFile(APP_DATA_FILE_NAME, content, FILE_OPTIONS),
    )
  },
}
