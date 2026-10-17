/**
 * 是否为开发环境
 */
export function isDev(): boolean {
  return import.meta.env.DEV;
}

/**
 * 是否为生产环境
 */
export function isProd(): boolean {
  return import.meta.env.PROD;
}
