<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  Cell,
  CellGroup,
  Icon,
  NavBar,
  showDialog,
  showSuccessToast,
} from 'vant'

import DataRecoveryPopup from '@/components/data/DataRecoveryPopup.vue'
import { useAppDataTransfer } from '@/composables/useAppDataTransfer'
import { useAppDataStore } from '@/stores/app-data-store'
import { getDataTransferErrorInfo } from '@/utils/data-transfer-error'

const router = useRouter()
const store = useAppDataStore()

const { exporting, importing, exportData, importData } = useAppDataTransfer()

const recoveryVisible = ref(false)

onMounted(() => {
  // 直接进入本页时 Store 可能尚未初始化，失败原因由页面展示。
  void store.initialize().catch(() => undefined)
})

const busy = computed(() => exporting.value || importing.value || store.saving)

const canOperate = computed(
  () => store.initialized && !store.loading && !busy.value,
)

const loadError = computed(() => store.error ?? '')

const groupCount = computed(() => store.groups.length)
const itemCount = computed(() => store.items.length)
const categoryCount = computed(() => store.categories.length)

function goBack() {
  router.back()
}

async function showTransferError(error: unknown) {
  const info = getDataTransferErrorInfo(error)

  await showDialog({
    title: info.title,
    message: `${info.message}\n\n${info.suggestion}`,
    confirmButtonText: '知道了',
  })
}

async function handleExport() {
  if (!canOperate.value) return

  try {
    const success = await exportData()

    if (success) {
      showSuccessToast('数据导出成功')
    }
  } catch (error) {
    await showTransferError(error)
  }
}

async function handleImport() {
  if (!canOperate.value) return

  try {
    const success = await importData()

    if (success) {
      showSuccessToast('数据导入成功')
    }
  } catch (error) {
    await showTransferError(error)
  }
}

function openRecovery() {
  if (busy.value) return

  recoveryVisible.value = true
}
</script>

<template>
  <div class="data-management-view">
    <NavBar title="数据管理" left-arrow @click-left="goBack" />

    <main class="management-content">
      <section>
        <h2 class="section-title">当前数据</h2>

        <div class="data-overview">
          <div class="overview-item">
            <strong>{{ groupCount }}</strong>
            <span>物品组</span>
          </div>

          <div class="overview-item">
            <strong>{{ itemCount }}</strong>
            <span>物品</span>
          </div>

          <div class="overview-item">
            <strong>{{ categoryCount }}</strong>
            <span>分类</span>
          </div>
        </div>

        <p
          v-if="store.loading && !store.initialized"
          class="section-description"
        >
          正在加载数据…
        </p>
        <p
          v-else-if="!store.initialized && loadError"
          class="section-description error-text"
        >
          数据加载失败：{{ loadError }}
        </p>
        <p v-else class="section-description">
          数据保存在设备本地，不依赖云端服务。
        </p>
      </section>

      <section>
        <h2 class="section-title">数据导入与导出</h2>

        <CellGroup inset>
          <Cell
            title="导出数据"
            label="将全部数据保存为 JSON 文件"
            is-link
            :clickable="canOperate"
            :class="{ 'cell-disabled': !canOperate }"
            @click="handleExport"
          >
            <template #icon>
              <Icon name="down" class="cell-icon" size="20" />
            </template>
            <template #right-icon>
              <Icon
                :name="exporting ? 'replay' : 'arrow'"
                class="cell-right-icon"
                :class="{ 'loading-icon': exporting }"
              />
            </template>
          </Cell>

          <Cell
            title="导入数据"
            label="选择 JSON 文件，替换当前全部数据"
            is-link
            :clickable="canOperate"
            :class="{ 'cell-disabled': !canOperate }"
            @click="handleImport"
          >
            <template #icon>
              <Icon name="upgrade" class="cell-icon" size="20" />
            </template>
            <template #right-icon>
              <Icon
                :name="importing ? 'replay' : 'arrow'"
                class="cell-right-icon"
                :class="{ 'loading-icon': importing }"
              />
            </template>
          </Cell>
        </CellGroup>

        <p class="section-description">
          导入前将校验文件格式并要求确认，同时自动创建当前数据的快照。导入不会与现有数据合并。
        </p>
      </section>

      <section>
        <h2 class="section-title">备份与恢复</h2>

        <CellGroup inset>
          <Cell
            title="检查备份与恢复"
            label="检查主数据、备份、临时文件、导入前快照与迁移前快照"
            is-link
            :clickable="!busy"
            :class="{ 'cell-disabled': busy }"
            @click="openRecovery"
          >
            <template #icon>
              <Icon name="shield-o" class="cell-icon" size="20" />
            </template>
          </Cell>
        </CellGroup>

        <p class="section-description">
          备份恢复用于处理数据文件损坏等异常情况。主数据正常时仍可通过导入前快照撤销最近一次导入，建议定期将数据导出到设备之外保存。
        </p>
      </section>
    </main>

    <DataRecoveryPopup v-model:show="recoveryVisible" />
  </div>
</template>

<style scoped>
.data-management-view {
  min-height: 100%;
  background: var(--et-color-bg-page);
}

.management-content {
  padding: 16px 0 32px;
}

.management-content section + section {
  margin-top: 28px;
}

.section-title {
  margin: 0 16px 12px;
  color: var(--et-color-text-hint);
  font-size: 14px;
  font-weight: 500;
}

.data-overview {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin: 0 16px;
  padding: 24px 12px;
  background: var(--van-cell-background);
  border-radius: var(--van-radius-lg);
}

.overview-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.overview-item strong {
  color: var(--et-color-text);
  font-size: 26px;
  font-weight: 600;
  line-height: 1;
}

.overview-item span {
  color: var(--et-color-text-hint);
  font-size: 12px;
}

.section-description {
  margin: 12px 16px 0;
  color: var(--et-color-text-hint);
  font-size: 12px;
  line-height: 1.6;
}

.error-text {
  color: var(--van-danger-color);
  overflow-wrap: anywhere;
}

.cell-icon {
  margin-right: 12px;
  color: var(--van-primary-color);
  align-self: center;
}

.cell-disabled {
  opacity: 0.5;
}

.cell-right-icon {
  height: var(--van-cell-line-height);
  margin-left: var(--van-padding-base);
  color: var(--van-cell-right-icon-color);
  font-size: var(--van-cell-icon-size);
  line-height: var(--van-cell-line-height);
}

.loading-icon {
  animation: rotate 1s linear infinite;
}

@keyframes rotate {
  to {
    transform: rotate(360deg);
  }
}
</style>
