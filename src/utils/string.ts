export const StringUtils = {
  isString(value: unknown): value is string {
    return typeof value === 'string'
  },

  createId(prefix: string): string {
    if (typeof crypto.randomUUID !== 'function') {
      throw new Error('当前环境不支持安全 ID 生成')
    }

    return `${prefix}_${crypto.randomUUID()}`
  },

  normalizeName(name: string): string {
    return name.trim().toLowerCase()
  },
}
