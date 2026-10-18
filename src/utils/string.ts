export const StringUtils = {
  isString(value: unknown): value is string {
    return typeof value === 'string'
  },
}
