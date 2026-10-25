<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { Cell, CellGroup, showFailToast, showSuccessToast } from 'vant'

import { useAppDataTransfer } from '@/composables/useAppDataTransfer'
import { useAppDataStore } from '@/stores/app-data-store'
import { ErrorUtils } from '@/utils/error'

const store = useAppDataStore()
const { initialized } = storeToRefs(store)

const { exporting, importing, exportData, importData } = useAppDataTransfer()

const busy = computed(
  () => exporting.value || importing.value || !initialized.value,
)

async function handleExport() {
  try {
    const success = await exportData()

    if (success) showSuccessToast('数据导出成功')
  } catch (error) {
    showFailToast(`导出失败：${ErrorUtils.getMessage(error)}`)
  }
}

async function handleImport() {
  try {
    const success = await importData()

    if (success) showSuccessToast('数据导入成功')
  } catch (error) {
    showFailToast(`导入失败：${ErrorUtils.getMessage(error)}`)
  }
}
</script>

<template>
  <div class="transfer-test">
    <h3>数据导入导出</h3>

    <CellGroup inset>
      <Cell
        title="导出数据"
        label="将当前已保存的数据导出为 JSON 文件"
        is-link
        :clickable="!busy"
        :value="exporting ? '正在导出…' : ''"
        @click="handleExport"
      />

      <Cell
        title="导入数据"
        label="从 JSON 文件恢复数据，将替换当前全部数据"
        is-link
        :clickable="!busy"
        :value="importing ? '正在导入…' : ''"
        @click="handleImport"
      />
    </CellGroup>

    <p v-if="!initialized" class="transfer-test__hint">
      数据尚未初始化，暂不能导入或导出。
    </p>
  </div>
</template>

<style scoped>
.transfer-test {
  padding: 16px;
}

.transfer-test__hint {
  margin: 12px 4px 0;
  color: var(--van-text-color-2);
  font-size: 12px;
}
</style>
