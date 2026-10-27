import {
  BaseDirectory,
  copyFile,
  exists,
  mkdir,
  readDir,
  readTextFile,
  remove,
  rename,
  writeTextFile,
} from '@tauri-apps/plugin-fs'

const baseDir = BaseDirectory.AppData

/**
 * 应用数据目录的文件系统边界
 *
 * 只负责把 Tauri FS API 转换为统一接口，不承载业务校验、
 * 迁移版本或备份策略，便于测试注入故障。
 */
export interface AppDataFileSystem {
  exists(path: string): Promise<boolean>
  mkdir(path: string): Promise<void>
  readDir(path: string): Promise<string[]>
  readText(path: string): Promise<string>
  writeText(path: string, content: string): Promise<void>
  copy(from: string, to: string): Promise<void>
  rename(from: string, to: string): Promise<void>
  remove(path: string): Promise<void>
}

export const tauriAppDataFileSystem: AppDataFileSystem = {
  exists(path) {
    return exists(path, { baseDir })
  },

  async mkdir(path) {
    await mkdir(path, { baseDir, recursive: true })
  },

  async readDir(path) {
    const entries = await readDir(path, { baseDir })

    return entries.filter((entry) => entry.isFile).map((entry) => entry.name)
  },

  readText(path) {
    return readTextFile(path, { baseDir })
  },

  async writeText(path, content) {
    await writeTextFile(path, content, { baseDir })
  },

  async copy(from, to) {
    await copyFile(from, to, {
      fromPathBaseDir: baseDir,
      toPathBaseDir: baseDir,
    })
  },

  async rename(from, to) {
    await rename(from, to, {
      oldPathBaseDir: baseDir,
      newPathBaseDir: baseDir,
    })
  },

  async remove(path) {
    await remove(path, { baseDir })
  },
}
