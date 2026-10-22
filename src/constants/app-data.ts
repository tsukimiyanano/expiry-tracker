/**
 * 应用数据文件名
 */
export const APP_DATA_FILE_NAME = 'app-data.json'

/**
 * 应用数据临时文件名
 *
 * 保存时先写入该文件，校验通过后再替换正式文件。
 */
export const APP_DATA_TEMP_FILE_NAME = `${APP_DATA_FILE_NAME}.tmp`

/**
 * 应用数据备份文件名
 *
 * 保存前将当前正式数据复制到该文件，作为恢复候选。
 */
export const APP_DATA_BACKUP_FILE_NAME = `${APP_DATA_FILE_NAME}.bak`

/**
 * 当前应用数据结构版本
 */
export const APP_DATA_VERSION = 1
