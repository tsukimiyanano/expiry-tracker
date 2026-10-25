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
 * 导入前快照文件名前缀
 *
 * 导入前保存当前正式数据的快照，避免导入后的日常保存
 * 覆盖导入前的状态。完整文件名形如
 * app-data.json.pre-import-20261025-142530。
 */
export const APP_DATA_IMPORT_SNAPSHOT_PREFIX = `${APP_DATA_FILE_NAME}.pre-import-`

/**
 * 导入前快照写入时的临时文件名
 *
 * 写入并回读校验通过后，才重命名为带时间戳的快照文件。
 */
export const APP_DATA_IMPORT_SNAPSHOT_TEMP_FILE_NAME = `${APP_DATA_FILE_NAME}.pre-import.tmp`

/**
 * 恢复暂存文件名
 *
 * 恢复时先复制候选文件到该文件，校验通过后再替换正式文件。
 */
export const APP_DATA_RESTORE_TEMP_FILE_NAME = `${APP_DATA_FILE_NAME}.restore.tmp`

/**
 * 当前应用数据结构版本
 */
export const APP_DATA_VERSION = 1
