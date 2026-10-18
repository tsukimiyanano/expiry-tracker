import { StringUtils } from '@/utils/string'

export const ArrayUtils = {
  isStringArray(value: unknown): value is string[] {
    return Array.isArray(value) && value.every(StringUtils.isString)
  },
}
