<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  Button,
  Cell,
  CellGroup,
  Loading,
  Popup,
  Tag,
  showConfirmDialog,
  showToast,
} from 'vant'

import { useBackButtonHandler } from '@/composables/useBackButtonHandler'
import { appDataRepository } from '@/repositories/app-data-repository'
import { useAppDataStore } from '@/stores/app-data-store'
import { DataRecoveryStatusUtils } from '@/utils/data-recovery-status'
import { ErrorUtils } from '@/utils/error'
import type {
  AppDataRecoveryStatus,
  RecoveryFileInfo,
  RecoverySource,
} from '@/types/data-recovery'

interface RecoveryFileEntry {
  title: string
  file: RecoveryFileInfo
  source: RecoverySource | null
}

const props = defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
}>()

const store = useAppDataStore()

const visible = computed({
  get: () => props.show,
  set: (value) => emit('update:show', value),
})

const status = ref<AppDataRecoveryStatus | null>(null)
const loadingStatus = ref(false)
const restoring = ref(false)
const restoringSource = ref<RecoverySource | null>(null)
const checkingError = ref<string | null>(null)
const error = ref<string | null>(null)

function close() {
  if (restoring.value) return

  emit('update:show', false)
}

// Android 返回键优先关闭弹窗；恢复过程中不响应，避免中断写入。
useBackButtonHandler(
  () => props.show,
  () => close(),
)

async function refreshStatus() {
  loadingStatus.value = true
  checkingError.value = null
  error.value = null

  // 清除旧结果，避免检查失败时继续展示过期状态。
  status.value = null

  try {
    status.value = await appDataRepository.getRecoveryStatus()
  } catch (cause) {
    checkingError.value = ErrorUtils.getMessage(cause)
  } finally {
    loadingStatus.value = false
  }
}

watch(
  () => props.show,
  (visible) => {
    if (visible) void refreshStatus()
  },
  { immediate: true },
)

function getFileStatus(file: RecoveryFileInfo) {
  return DataRecoveryStatusUtils.getFilePresentation(file)
}

function getFileLabel(entry: RecoveryFileEntry): string {
  const file = entry.file
  const details: string[] = []

  // 快照文件名包含创建时间或版本信息，展示后便于用户判断要回退到哪一份数据。
  if (
    (entry.source === 'import-snapshot' ||
      entry.source === 'migration-snapshot') &&
    file.state !== 'missing'
  ) {
    details.push(file.fileName)
  }

  details.push(getFileStatus(file).description)

  if (file.summary) {
    details.push(
      `${file.summary.groupCount} 个分组 · ${file.summary.itemCount} 件物品 · ${file.summary.categoryCount} 个分类`,
    )
  } else if (file.error) {
    details.push(file.error)
  }

  return details.join('；')
}

const recoveryFiles = computed<RecoveryFileEntry[]>(() => {
  if (!status.value) return []

  return [
    { title: '正式数据', file: status.value.main, source: null },
    { title: '备份文件', file: status.value.backup, source: 'backup' },
    { title: '临时文件', file: status.value.temp, source: 'temp' },
    {
      title: '导入前快照',
      file: status.value.importSnapshot,
      source: 'import-snapshot',
    },
    {
      title: '迁移前快照',
      file: status.value.migrationSnapshot,
      source: 'migration-snapshot',
    },
  ]
})

const recoveryMessage = computed(() =>
  status.value ? DataRecoveryStatusUtils.getRecoveryMessage(status.value) : '',
)

function canRestore(source: RecoverySource): boolean {
  return status.value
    ? DataRecoveryStatusUtils.canRestore(status.value, source)
    : false
}

async function restore(source: RecoverySource) {
  if (restoring.value || !canRestore(source)) return

  const sourceLabel =
    source === 'backup'
      ? '最近一次备份'
      : source === 'temp'
        ? '保存中断时的临时数据'
        : source === 'import-snapshot'
          ? '最近一次导入前的快照'
          : '数据版本迁移前的快照'

  // 撤销导入或迁移会覆盖当前有效数据，需要额外说明后果。
  const extraHint =
    source === 'import-snapshot'
      ? '当前已导入的数据将被撤销。'
      : source === 'migration-snapshot'
        ? '当前数据将回退到版本迁移前的内容。'
        : ''

  try {
    await showConfirmDialog({
      title: '确认恢复数据',
      message:
        `将使用${sourceLabel}替换当前正式数据。` +
        extraHint +
        '恢复前会尽量保留现有主文件作为现场副本。' +
        '请确认该候选文件中的数据是你希望恢复的版本。',
      confirmButtonText: '确认恢复',
      confirmButtonColor: 'var(--van-danger-color)',
    })
  } catch {
    return
  }

  restoring.value = true
  restoringSource.value = source
  error.value = null

  try {
    await appDataRepository.restoreFromRecovery(source)

    // 主文件恢复完成后，强制从磁盘重新读取并更新 Store。
    await store.reload()

    showToast('数据恢复成功')
    emit('update:show', false)
  } catch (cause) {
    const message = ErrorUtils.getMessage(cause)

    // 失败后刷新状态，便于用户判断当前文件情况。
    // refreshStatus() 会清空旧状态，因此刷新后再展示恢复失败原因。
    await refreshStatus()
    error.value = message
  } finally {
    restoring.value = false
    restoringSource.value = null
  }
}
</script>

<template>
  <Popup
    v-model:show="visible"
    position="bottom"
    round
    safe-area-inset-bottom
    :style="{ maxHeight: '85vh' }"
    :close-on-click-overlay="!restoring"
  >
    <div class="recovery-panel">
      <div class="recovery-panel__header">
        <h3>数据备份与恢复</h3>
        <Button
          size="small"
          plain
          native-type="button"
          :disabled="restoring"
          @click="close"
        >
          关闭
        </Button>
      </div>

      <div v-if="loadingStatus" class="recovery-panel__loading">
        <Loading vertical>正在检查数据文件...</Loading>
      </div>

      <div v-else-if="checkingError" class="recovery-panel__check-error">
        <p>备份检查失败，无法确定当前文件状态，请勿执行恢复操作。</p>
        <p class="recovery-panel__error">{{ checkingError }}</p>
      </div>

      <template v-else-if="status">
        <CellGroup inset>
          <Cell
            v-for="entry in recoveryFiles"
            :key="entry.file.fileName"
            :title="entry.title"
            :label="getFileLabel(entry)"
          >
            <template #value>
              <Tag :type="getFileStatus(entry.file).color">
                {{ getFileStatus(entry.file).label }}
              </Tag>
            </template>
          </Cell>
        </CellGroup>

        <p class="recovery-panel__hint">
          {{ recoveryMessage }}
        </p>

        <div class="recovery-panel__actions">
          <Button
            type="primary"
            class="recovery-action"
            :loading="restoring && restoringSource === 'import-snapshot'"
            :disabled="
              loadingStatus || restoring || !canRestore('import-snapshot')
            "
            @click="restore('import-snapshot')"
          >
            撤销导入（导入前快照）
          </Button>
        </div>

        <div class="recovery-panel__actions recovery-panel__actions--secondary">
          <Button
            class="recovery-action"
            :loading="restoring && restoringSource === 'migration-snapshot'"
            :disabled="
              loadingStatus || restoring || !canRestore('migration-snapshot')
            "
            @click="restore('migration-snapshot')"
          >
            从迁移前快照恢复
          </Button>
        </div>

        <div class="recovery-panel__actions recovery-panel__actions--secondary">
          <Button
            class="recovery-action"
            :loading="restoring && restoringSource === 'backup'"
            :disabled="loadingStatus || restoring || !canRestore('backup')"
            @click="restore('backup')"
          >
            从备份恢复
          </Button>

          <Button
            class="recovery-action"
            :loading="restoring && restoringSource === 'temp'"
            :disabled="loadingStatus || restoring || !canRestore('temp')"
            @click="restore('temp')"
          >
            从临时文件恢复
          </Button>
        </div>

        <p class="recovery-panel__hint">
          恢复不会删除备份文件、导入前快照、迁移前快照或原始候选文件，恢复前会尽量保留现有主文件。
        </p>
      </template>

      <p v-if="error" class="recovery-panel__error">
        {{ error }}
      </p>

      <div class="recovery-panel__footer">
        <Button
          block
          plain
          :disabled="loadingStatus || restoring"
          @click="refreshStatus"
        >
          重新检查
        </Button>
      </div>
    </div>
  </Popup>
</template>

<style scoped>
.recovery-panel {
  padding: 16px 0 24px;
}

.recovery-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin: 0 16px 20px;
}

.recovery-panel__header h3 {
  margin: 0;
  font-size: 18px;
}

.recovery-panel__loading {
  padding: 32px 0;
}

.recovery-panel__check-error {
  margin: 8px 16px;
  color: var(--et-color-text-hint);
  font-size: 13px;
  line-height: 1.6;
}

.recovery-panel__check-error p {
  margin: 0;
}

.recovery-panel__check-error .recovery-panel__error {
  margin: 8px 0 0;
}

.recovery-panel__actions {
  display: flex;
  gap: 12px;
  margin: 0 16px;
}

.recovery-panel__actions--secondary {
  margin-top: 8px;
}

.recovery-action {
  flex: 1;
}

.recovery-panel__hint,
.recovery-panel__error {
  margin: 16px;
  font-size: 13px;
  overflow-wrap: anywhere;
}

.recovery-panel__hint {
  color: var(--et-color-text-hint);
}

.recovery-panel__error {
  color: var(--van-danger-color);
}

.recovery-panel__footer {
  padding: 20px 16px 0;
}
</style>
