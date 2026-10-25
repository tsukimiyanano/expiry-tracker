<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  Button,
  Cell,
  CellGroup,
  Loading,
  Popup,
  showConfirmDialog,
  showToast,
} from 'vant'

import { useBackButtonHandler } from '@/composables/useBackButtonHandler'
import { appDataRepository } from '@/repositories/app-data-repository'
import { useAppDataStore } from '@/stores/app-data-store'
import { ErrorUtils } from '@/utils/error'
import type {
  AppDataRecoveryStatus,
  RecoveryFileInfo,
  RecoverySource,
} from '@/types/data-recovery'

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
  error.value = null

  try {
    status.value = await appDataRepository.getRecoveryStatus()
  } catch (cause) {
    error.value = ErrorUtils.getMessage(cause)
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

function fileStateLabel(file: RecoveryFileInfo): string {
  switch (file.state) {
    case 'missing':
      return '不存在'
    case 'valid':
      return '有效'
    case 'invalid':
      return '数据损坏或格式无效'
    case 'unreadable':
      return '无法读取'
  }
}

function fileSummary(file: RecoveryFileInfo): string {
  if (!file.summary) return file.error ?? ''

  return `${file.summary.groupCount} 个分组 · ${file.summary.itemCount} 件物品 · ${file.summary.categoryCount} 个分类`
}

async function restore(source: RecoverySource) {
  if (restoring.value || !status.value) return

  const candidate =
    source === 'backup' ? status.value.backup : status.value.temp

  if (candidate.state !== 'valid') return

  const sourceLabel =
    source === 'backup' ? '最近一次备份' : '保存中断时的临时数据'

  try {
    await showConfirmDialog({
      title: '确认恢复数据',
      message:
        `将使用${sourceLabel}替换当前正式数据。` +
        '恢复前会尽量保留现有主文件作为损坏现场。' +
        '请确认该候选文件中的数据是你希望恢复的版本。',
      confirmButtonText: '确认恢复',
      confirmButtonColor: 'var(--van-danger-color)',
    })
  } catch {
    return
  }

  restoring.value = true
  error.value = null

  try {
    await appDataRepository.restoreFromRecovery(source)

    // 主文件恢复完成后，重新读取并更新 Store。
    await store.initialize()

    showToast('数据恢复成功')
    emit('update:show', false)
  } catch (cause) {
    const message = ErrorUtils.getMessage(cause)

    // 失败后刷新状态，便于用户判断当前文件情况。
    // refreshStatus() 会清空 error，因此刷新后再展示恢复失败原因。
    await refreshStatus()
    error.value = message
  } finally {
    restoring.value = false
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

      <template v-else-if="status">
        <CellGroup inset>
          <Cell
            title="正式数据"
            :value="fileStateLabel(status.main)"
            :label="fileSummary(status.main)"
          />
          <Cell
            title="备份文件"
            :value="fileStateLabel(status.backup)"
            :label="fileSummary(status.backup)"
          >
            <template #right-icon>
              <Button
                v-if="
                  status.main.state !== 'valid' &&
                  status.backup.state === 'valid'
                "
                size="small"
                type="primary"
                plain
                :loading="restoring"
                :disabled="restoring"
                @click="restore('backup')"
              >
                恢复备份
              </Button>
            </template>
          </Cell>
          <Cell
            title="临时文件"
            :value="fileStateLabel(status.temp)"
            :label="fileSummary(status.temp)"
          >
            <template #right-icon>
              <Button
                v-if="
                  status.main.state !== 'valid' && status.temp.state === 'valid'
                "
                size="small"
                type="primary"
                plain
                :loading="restoring"
                :disabled="restoring"
                @click="restore('temp')"
              >
                恢复临时数据
              </Button>
            </template>
          </Cell>
        </CellGroup>

        <p class="recovery-panel__hint">
          只有通过数据结构校验的候选文件才能恢复。恢复不会删除备份文件或原始候选文件。
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

.recovery-panel__hint,
.recovery-panel__error {
  margin: 16px;
  font-size: 13px;
  overflow-wrap: anywhere;
}

.recovery-panel__hint {
  color: var(--van-text-color-2);
}

.recovery-panel__error {
  color: var(--van-danger-color);
}

.recovery-panel__footer {
  padding: 20px 16px 0;
}
</style>
