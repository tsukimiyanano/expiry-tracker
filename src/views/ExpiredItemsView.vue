<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { Button, Icon, Loading, NavBar, showConfirmDialog } from 'vant'
import { useRoute, useRouter } from 'vue-router'

import ItemFormPopup from '@/components/items/ItemFormPopup.vue'
import { useAppDataStore } from '@/stores/app-data-store'
import type { Item } from '@/types/item'
import type { ExpiryStatusInfo } from '@/utils/date'
import { DateUtils } from '@/utils/date'
import { ErrorUtils } from '@/utils/error'

interface ExpiredItem extends Item {
  expiryStatus: ExpiryStatusInfo
  groupName: string
}

const route = useRoute()
const router = useRouter()
const store = useAppDataStore()

const { groups, items, initialized, loading, saving, error } =
  storeToRefs(store)

const operationError = ref<string | null>(null)
const markingItemId = ref<string | null>(null)
const deletingItemId = ref<string | null>(null)

const itemFormVisible = ref(false)
const editingItem = ref<Item | null>(null)

const busy = computed(
  () =>
    saving.value ||
    markingItemId.value !== null ||
    deletingItemId.value !== null,
)

// 分组入口会带上 groupId，用于只查看该分组的过期物品。
const scopedGroupId = computed(() => {
  const value = route.query.groupId

  return typeof value === 'string' && value ? value : null
})

const groupNameMap = computed(
  () => new Map(groups.value.map((group) => [group.id, group.name])),
)

const scopedGroupName = computed(() =>
  scopedGroupId.value
    ? (groupNameMap.value.get(scopedGroupId.value) ?? '')
    : '',
)

const expiredItems = computed<ExpiredItem[]>(() =>
  items.value
    .filter(
      (item) => !scopedGroupId.value || item.groupId === scopedGroupId.value,
    )
    .map((item) => ({
      ...item,
      expiryStatus: DateUtils.getExpiryStatus(item.expireDate, item.isUsed),
      groupName: groupNameMap.value.get(item.groupId) ?? '未知分组',
    }))
    .filter((item) => item.expiryStatus.status === 'expired')
    .sort((a, b) => a.expireDate.localeCompare(b.expireDate)),
)

const expiredGroupCount = computed(
  () => new Set(expiredItems.value.map((item) => item.groupId)).size,
)

const summaryText = computed(() => {
  const countText = `共 ${expiredItems.value.length} 件`

  return scopedGroupName.value
    ? `${scopedGroupName.value} · ${countText}`
    : `${countText} · 来自 ${expiredGroupCount.value} 个分组`
})

function goBack() {
  if (router.options.history.state.back) {
    router.back()
  } else {
    void router.replace({ name: 'home' })
  }
}

function initialize() {
  operationError.value = null

  // 初始化失败时由 Store 保存错误状态，页面负责展示。
  void store.initialize().catch(() => undefined)
}

onMounted(() => {
  if (!initialized.value) {
    initialize()
  }
})

function getOverdueDays(item: ExpiredItem): number {
  return Math.abs(item.expiryStatus.daysRemaining ?? 0)
}

function getMetaText(item: ExpiredItem): string {
  const groupPrefix = item.productName ? `${item.groupName} · ` : ''

  return `${groupPrefix}到期日期 ${item.expireDate}`
}

function openEditItem(item: Item) {
  if (busy.value) return

  editingItem.value = item
  itemFormVisible.value = true
}

async function markUsed(item: ExpiredItem) {
  if (busy.value) return

  markingItemId.value = item.id
  operationError.value = null

  try {
    await store.updateItem(item.id, { isUsed: true })
  } catch (cause) {
    operationError.value = ErrorUtils.getMessage(cause)
  } finally {
    markingItemId.value = null
  }
}

async function confirmDelete(item: ExpiredItem) {
  if (busy.value) return

  try {
    await showConfirmDialog({
      title: '删除物品',
      message: `确定删除「${item.productName || item.groupName || item.expireDate}」吗？删除后无法恢复。`,
      confirmButtonText: '删除',
      confirmButtonColor: 'var(--van-danger-color)',
    })
  } catch {
    // 用户取消确认，不执行删除。
    return
  }

  // 确认弹窗期间数据可能已经变化，再次检查。
  if (busy.value) return

  deletingItemId.value = item.id
  operationError.value = null

  try {
    await store.deleteItem(item.id)
  } catch (cause) {
    operationError.value = ErrorUtils.getMessage(cause)
  } finally {
    deletingItemId.value = null
  }
}
</script>

<template>
  <NavBar title="已过期物品" left-arrow @click-left="goBack" />

  <div class="expired-page">
    <div v-if="loading && !initialized" class="state-message">
      <Loading vertical>正在加载物品数据...</Loading>
    </div>

    <div v-else-if="!initialized" class="state-message">
      <p>{{ operationError || error || '物品数据尚未初始化' }}</p>
      <Button size="small" type="primary" @click="initialize">重试</Button>
    </div>

    <template v-else>
      <p v-if="operationError" class="operation-error">
        {{ operationError }}
      </p>

      <div v-if="expiredItems.length === 0" class="empty-state">
        <Icon name="passed" size="48" color="var(--van-success-color)" />
        <p class="empty-title">暂无已过期物品</p>
        <p class="empty-desc">记得定期查看即将到期的物品。</p>
        <Button
          class="empty-action"
          plain
          type="primary"
          size="small"
          @click="goBack"
        >
          返回上一页
        </Button>
      </div>

      <template v-else>
        <div class="list-summary">{{ summaryText }}</div>

        <div class="expired-list">
          <article
            v-for="item in expiredItems"
            :key="item.id"
            class="expired-item"
          >
            <div class="expired-item__head">
              <span class="expired-item__name">
                {{ item.productName || item.groupName }}
              </span>

              <span class="expired-item__days">
                已过期 {{ getOverdueDays(item) }} 天
              </span>
            </div>

            <p class="expired-item__meta">{{ getMetaText(item) }}</p>

            <p v-if="item.note" class="expired-item__note">
              {{ item.note }}
            </p>

            <div class="expired-item__actions">
              <Button
                size="mini"
                plain
                type="primary"
                :loading="markingItemId === item.id"
                :disabled="busy && markingItemId !== item.id"
                @click="markUsed(item)"
              >
                标记用完
              </Button>

              <Button
                size="mini"
                plain
                :disabled="busy"
                @click="openEditItem(item)"
              >
                编辑
              </Button>

              <Button
                size="mini"
                plain
                type="danger"
                :loading="deletingItemId === item.id"
                :disabled="busy && deletingItemId !== item.id"
                @click="confirmDelete(item)"
              >
                删除
              </Button>
            </div>
          </article>
        </div>
      </template>
    </template>
  </div>

  <ItemFormPopup
    v-model:show="itemFormVisible"
    mode="edit"
    :item="editingItem"
  />
</template>

<style scoped>
.expired-page {
  min-height: 100%;
  padding: 12px 12px 32px;
  background: var(--van-background, #f7f8fa);
}

.state-message {
  padding: 48px 16px;
  color: var(--van-text-color-2, #646566);
  text-align: center;
  font-size: 14px;
  overflow-wrap: anywhere;
}

.operation-error {
  margin: 0 4px 12px;
  color: var(--van-danger-color, #ee0a24);
  font-size: 13px;
  overflow-wrap: anywhere;
}

.empty-state {
  padding: 48px 16px;
  text-align: center;
}

.empty-title {
  margin: 12px 0 0;
  color: var(--van-text-color, #323233);
  font-size: 18px;
  font-weight: 600;
}

.empty-desc {
  margin: 4px 0 0;
  color: var(--van-text-color-2, #646566);
  font-size: 13px;
}

.empty-action {
  margin-top: 16px;
}

.list-summary {
  margin: 0 4px 12px;
  color: var(--van-text-color-2, #646566);
  font-size: 13px;
}

.expired-list {
  overflow: hidden;
  border-radius: 8px;
  background: var(--van-background-2, #fff);
}

.expired-item {
  padding: 14px 12px;
}

.expired-item + .expired-item {
  border-top: 1px solid var(--van-border-color, #ebedf0);
}

.expired-item__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.expired-item__name {
  min-width: 0;
  font-size: 15px;
  font-weight: 500;
  overflow-wrap: anywhere;
}

.expired-item__days {
  flex-shrink: 0;
  color: var(--van-danger-color, #ee0a24);
  font-size: 12px;
  font-weight: 500;
}

.expired-item__meta {
  margin: 5px 0 0;
  color: var(--van-text-color-2, #646566);
  font-size: 12px;
  overflow-wrap: anywhere;
}

.expired-item__note {
  margin: 5px 0 0;
  color: var(--van-text-color-2, #646566);
  font-size: 12px;
  overflow-wrap: anywhere;
}

.expired-item__actions {
  display: flex;
  gap: 8px;
  margin-top: 10px;
}
</style>
