import type { AppDataFileSystem } from '@/repositories/app-data-file-system'

type FileOperation =
  | 'exists'
  | 'mkdir'
  | 'readDir'
  | 'readText'
  | 'writeText'
  | 'copy'
  | 'rename'
  | 'remove'

export interface FileFailure {
  operation: FileOperation
  path?: string
  /** 第几次该操作时触发；省略表示下一次匹配的操作。 */
  occurrence?: number
  /** 默认只触发一次。 */
  once?: boolean
}

/**
 * 内存文件系统
 *
 * 实现 Repository 的文件系统边界，用于精确控制文件内容与故障位置。
 * 有意简化：不模拟断电、部分写入或真实 Android 文件 URI。
 */
export class MemoryFileSystem implements AppDataFileSystem {
  readonly files = new Map<string, string>()
  readonly directories = new Set<string>()

  private failures: FileFailure[] = []
  private readonly operationCounts = new Map<string, number>()

  failNext(failure: FileFailure): void {
    this.failures.push({
      ...failure,
      once: failure.once ?? true,
    })
  }

  private checkFailure(operation: FileOperation, path: string): void {
    const count = (this.operationCounts.get(operation) ?? 0) + 1
    this.operationCounts.set(operation, count)

    const index = this.failures.findIndex((failure) => {
      if (failure.operation !== operation) return false

      if (failure.path !== undefined && failure.path !== path) {
        return false
      }

      return failure.occurrence === undefined || failure.occurrence === count
    })

    if (index === -1) return

    const failure = this.failures[index]

    if (failure.once) {
      this.failures.splice(index, 1)
    }

    throw new Error(`Simulated filesystem failure: ${operation} ${path}`)
  }

  async exists(path: string): Promise<boolean> {
    this.checkFailure('exists', path)

    return this.files.has(path) || this.directories.has(path)
  }

  async mkdir(path: string): Promise<void> {
    this.checkFailure('mkdir', path)
    this.directories.add(path)
  }

  async readDir(path: string): Promise<string[]> {
    this.checkFailure('readDir', path)

    if (!this.directories.has(path)) {
      throw new Error(`Directory not found: ${path}`)
    }

    const prefix = path === '.' ? '' : path.endsWith('/') ? path : `${path}/`

    return [...this.files.keys()]
      .filter((name) => {
        if (!name.startsWith(prefix)) return false

        const remaining = name.slice(prefix.length)

        return remaining.length > 0 && !remaining.includes('/')
      })
      .map((name) => name.slice(prefix.length))
  }

  async readText(path: string): Promise<string> {
    this.checkFailure('readText', path)

    const value = this.files.get(path)

    if (value === undefined) {
      throw new Error(`File not found: ${path}`)
    }

    return value
  }

  async writeText(path: string, content: string): Promise<void> {
    this.checkFailure('writeText', path)
    this.files.set(path, content)
  }

  async copy(from: string, to: string): Promise<void> {
    this.checkFailure('copy', from)

    const content = await this.readText(from)

    // 与 Tauri copyFile 的默认行为一致：允许覆盖目标文件。
    this.files.set(to, content)
  }

  async rename(from: string, to: string): Promise<void> {
    this.checkFailure('rename', from)

    const content = this.files.get(from)

    if (content === undefined) {
      throw new Error(`File not found: ${from}`)
    }

    this.files.delete(from)
    this.files.set(to, content)
  }

  async remove(path: string): Promise<void> {
    this.checkFailure('remove', path)
    this.files.delete(path)
  }
}
