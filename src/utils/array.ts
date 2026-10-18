import { StringUtils } from './string'

export const ArrayUtils = {
  isStringArray(value: unknown): value is string[] {
    return Array.isArray(value) && value.every(StringUtils.isString)
  },
}
