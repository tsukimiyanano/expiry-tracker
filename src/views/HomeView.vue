<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { Button, Icon, NavBar, Tag, showConfirmDialog } from 'vant'
import { useRouter } from 'vue-router'

import DataRecoveryPopup from '@/components/data/DataRecoveryPopup.vue'
import GroupEditPopup from '@/components/items/GroupEditPopup.vue'
import ItemFormPopup from '@/components/items/ItemFormPopup.vue'
import { useAppDataStore } from '@/stores/app-data-store'
import type { Item } from '@/types/item'
import type { ItemGroup } from '@/types/item-group'
import { DateUtils } from '@/utils/date'
import type { ExpiryStatus } from '@/utils/date'
import { ErrorUtils } from '@/utils/error'
import { isDev } from '@/utils/env'

const EXPIRY_TAG_TYPES: Record<
  ExpiryStatus,
  'success' | 'danger' | 'warning' | 'primary'
> = {
  used: 'success',
  expired: 'danger',
  today: 'danger',
  soon: 'warning',
  normal: 'primary',
}

const router = useRouter()
const store = useAppDataStore()

const { groups, items, categories, initialized, loading, saving, error } =
  storeToRefs(store)

onMounted(() => {
  // 初始化失败时由 Store 保存错误状态，页面负责展示。
  void store.initialize().catch(() => undefined)
})

const errorMessage = computed(() =>
  error.value ? ErrorUtils.getMessage(error.value) : '',
)

type ItemFormMode = 'create' | 'add' | 'edit'

const itemFormVisible = ref(false)
const itemFormMode = ref<ItemFormMode>('create')
const selectedGroup = ref<ItemGroup | null>(null)
const selectedItem = ref<Item | null>(null)

const deletingItemId = ref<string | null>(null)
const operationError = ref<string | null>(null)

const groupEditVisible = ref(false)
const editingGroup = ref<ItemGroup | null>(null)

const recoveryVisible = ref(false)

const editingGroupItemCount = computed(() => {
  if (!editingGroup.value) return 0

  return items.value.filter((item) => item.groupId === editingGroup.value?.id)
    .length
})

function openDataManagement() {
  void router.push({ name: 'data-management' })
}

function openCreateItem() {
  if (saving.value) return

  itemFormMode.value = 'create'
  selectedGroup.value = null
  selectedItem.value = null
  itemFormVisible.value = true
}

function openAddItem(group: ItemGroup) {
  if (saving.value) return

  itemFormMode.value = 'add'
  selectedGroup.value = group
  selectedItem.value = null
  itemFormVisible.value = true
}

function openEditItem(item: Item) {
  if (saving.value) return

  itemFormMode.value = 'edit'
  selectedItem.value = item
  selectedGroup.value = null
  itemFormVisible.value = true
}

async function confirmDeleteItem(item: Item) {
  if (saving.value || deletingItemId.value) return

  try {
    await showConfirmDialog({
      title: '删除物品',
      message: '确定删除这件物品吗？删除后无法恢复。',
      confirmButtonColor: 'var(--van-danger-color)',
    })
  } catch {
    // 用户取消确认，不执行删除。
    return
  }

  deletingItemId.value = item.id
  operationError.value = null

  try {
    await store.deleteItem(item.id)
  } catch (error) {
    operationError.value = ErrorUtils.getMessage(error)
  } finally {
    deletingItemId.value = null
  }
}

function openEditGroup(group: ItemGroup) {
  if (saving.value) return

  editingGroup.value = group
  groupEditVisible.value = true
}

function openExpiredItems(groupId: string | null = null) {
  void router.push({
    name: 'expired-items',
    query: groupId ? { groupId } : {},
  })
}

const expiredItems = computed(() =>
  items.value
    .map((item) => ({
      ...item,
      expiryStatus: DateUtils.getExpiryStatus(item.expireDate, item.isUsed),
    }))
    .filter((item) => item.expiryStatus.status === 'expired')
    .sort((a, b) => a.expireDate.localeCompare(b.expireDate)),
)

const expiredGroupCount = computed(
  () => new Set(expiredItems.value.map((item) => item.groupId)).size,
)

const listGroups = computed(() => {
  const categoryMap = new Map(
    categories.value.map((category) => [category.id, category]),
  )

  return groups.value
    .map((group) => {
      const groupItems = items.value
        .filter((item) => item.groupId === group.id)
        .map((item) => ({
          ...item,
          // 统一在数据层计算状态，模板只负责展示。
          expiryStatus: DateUtils.getExpiryStatus(item.expireDate, item.isUsed),
        }))
        .sort((a, b) => {
          // 未用完的物品排在前面，再按日期升序排列。
          if (a.isUsed !== b.isUsed) {
            return Number(a.isUsed) - Number(b.isUsed)
          }

          return a.expireDate.localeCompare(b.expireDate)
        })

      // 过期物品统一收进提醒条与弹层，分组列表只展示仍可查看的物品。
      const displayItems = groupItems.filter(
        (item) => item.expiryStatus.status !== 'expired',
      )
      const expiredCount = groupItems.length - displayItems.length
      const activeItems = displayItems.filter((item) => !item.isUsed)

      return {
        ...group,
        items: displayItems,
        expiredCount,
        categoryNames: group.categoryIds
          .map((id) => categoryMap.get(id)?.name)
          .filter((name): name is string => name !== undefined),
        activeCount: activeItems.length,
        nearestExpireDate: activeItems[0]?.expireDate ?? null,
      }
    })
    .sort((a, b) => {
      // 全部用完的分组沉底。
      if (a.nearestExpireDate === null) {
        return b.nearestExpireDate === null ? 0 : 1
      }

      if (b.nearestExpireDate === null) {
        return -1
      }

      return a.nearestExpireDate.localeCompare(b.nearestExpireDate)
    })
})
</script>

<template>
  <div class="home-page">
    <NavBar title="物品过期管理">
      <template #right>
        <div class="nav-actions">
          <span class="nav-action" @click="router.push({ name: 'categories' })">
            分类管理
          </span>

          <Icon
            name="setting-o"
            class="nav-action nav-action-icon"
            size="22"
            @click="openDataManagement"
          />
        </div>
      </template>
    </NavBar>

    <main class="home-content">
      <div v-if="saving" class="saving-tip">正在保存数据…</div>

      <div v-if="initialized" class="create-entry">
        <Button
          block
          type="primary"
          icon="plus"
          :disabled="loading || saving"
          @click="openCreateItem"
        >
          新建物品
        </Button>
      </div>

      <p v-if="operationError" class="operation-error">
        {{ operationError }}
      </p>

      <div v-if="loading && !initialized" class="state-message">
        正在加载物品数据…
      </div>

      <div
        v-else-if="errorMessage && !initialized"
        class="state-message error-message"
      >
        <p>物品数据加载失败</p>
        <p>{{ errorMessage }}</p>
        <button type="button" @click="store.initialize()">重试</button>
        <Button
          class="recovery-entry"
          plain
          type="primary"
          size="small"
          @click="recoveryVisible = true"
        >
          检查备份与恢复
        </Button>
      </div>

      <div v-else-if="!initialized" class="state-message">正在准备数据…</div>

      <div
        v-else-if="listGroups.length === 0"
        class="state-message empty-state"
      >
        <p class="empty-title">还没有物品</p>
        <p>添加物品后，就可以在这里查看过期日期。</p>
      </div>

      <template v-else>
        <button
          v-if="expiredItems.length > 0"
          type="button"
          class="expired-banner"
          @click="openExpiredItems()"
        >
          <span class="expired-banner__icon">
            <Icon name="warning-o" size="16" />
          </span>

          <span class="expired-banner__content">
            <span class="expired-banner__title">
              {{ expiredItems.length }} 件物品已过期
            </span>
            <span class="expired-banner__desc">
              来自 {{ expiredGroupCount }} 个分组
            </span>
          </span>

          <span class="expired-banner__action">
            去处理
            <Icon name="arrow" size="12" />
          </span>
        </button>

        <div class="list-summary">
          共 {{ groups.length }} 个分组，{{ items.length }} 件物品
        </div>

        <section v-for="group in listGroups" :key="group.id" class="group-card">
          <header class="group-header">
            <div class="group-title">{{ group.name }}</div>
            <div class="group-count">{{ group.activeCount }} 件未用完</div>
          </header>

          <div v-if="group.categoryNames.length > 0" class="category-list">
            <Tag
              v-for="name in group.categoryNames"
              :key="name"
              type="primary"
              plain
            >
              {{ name }}
            </Tag>
          </div>

          <div class="group-actions">
            <Button
              size="small"
              plain
              type="primary"
              :disabled="saving"
              @click="openAddItem(group)"
            >
              添加同组物品
            </Button>

            <Button
              size="small"
              plain
              icon="edit"
              :disabled="saving"
              @click="openEditGroup(group)"
            >
              管理分组
            </Button>
          </div>

          <div
            v-for="item in group.items"
            :key="item.id"
            class="item-row"
            :class="{ 'item-row-used': item.isUsed }"
          >
            <div class="item-main">
              <div class="item-name">
                {{ item.productName || group.name }}
              </div>

              <div v-if="item.note" class="item-note">
                {{ item.note }}
              </div>

              <div class="item-date">到期日期：{{ item.expireDate }}</div>
            </div>

            <div class="item-side">
              <Tag :type="EXPIRY_TAG_TYPES[item.expiryStatus.status]">
                {{ item.expiryStatus.label }}
              </Tag>

              <div class="item-actions">
                <Button
                  size="mini"
                  plain
                  :disabled="saving"
                  @click="openEditItem(item)"
                >
                  编辑
                </Button>

                <Button
                  size="mini"
                  plain
                  type="danger"
                  :loading="deletingItemId === item.id"
                  :disabled="saving"
                  @click="confirmDeleteItem(item)"
                >
                  删除
                </Button>
              </div>
            </div>
          </div>

          <button
            v-if="group.expiredCount > 0"
            type="button"
            class="group-expired-entry"
            @click="openExpiredItems(group.id)"
          >
            <span>{{ group.expiredCount }} 件已过期</span>

            <span class="group-expired-entry__action">
              去处理
              <Icon name="arrow" size="12" />
            </span>
          </button>
        </section>
      </template>

      <div v-if="isDev()" class="dev-entry">
        <Button block @click="router.push({ name: 'DevTest' })">
          开发测试
        </Button>
      </div>
    </main>

    <ItemFormPopup
      v-model:show="itemFormVisible"
      :mode="itemFormMode"
      :group="selectedGroup"
      :item="selectedItem"
    />

    <GroupEditPopup
      v-model:show="groupEditVisible"
      :group="editingGroup"
      :item-count="editingGroupItemCount"
    />

    <DataRecoveryPopup v-model:show="recoveryVisible" />
  </div>
</template>

<style scoped>
.home-page {
  min-height: 100%;
  background: var(--van-background, #f7f8fa);
}

.home-content {
  padding: 12px;
}

.nav-actions {
  display: flex;
  align-items: center;
  gap: 16px;
}

.nav-action {
  color: var(--van-primary-color, #1989fa);
  font-size: 14px;
}

.nav-action-icon {
  display: flex;
  align-items: center;
}

.saving-tip {
  margin-bottom: 8px;
  color: var(--van-text-color-2, #646566);
  font-size: 12px;
  text-align: right;
}

.create-entry {
  margin-bottom: 12px;
}

.expired-banner {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  margin-bottom: 12px;
  padding: 10px 12px;
  border: 1px solid #ffd7d9;
  border-radius: 10px;
  background: #fff5f5;
  font: inherit;
  text-align: left;
}

.expired-banner:active {
  background: #ffecec;
}

.expired-banner__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: #ffe1e3;
  color: var(--van-danger-color, #ee0a24);
}

.expired-banner__content {
  display: flex;
  flex: 1;
  min-width: 0;
  flex-direction: column;
}

.expired-banner__title {
  color: var(--van-danger-color, #ee0a24);
  font-size: 14px;
  font-weight: 600;
}

.expired-banner__desc {
  margin-top: 1px;
  color: var(--van-text-color-2, #646566);
  font-size: 12px;
}

.expired-banner__action {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 2px;
  color: var(--van-danger-color, #ee0a24);
  font-size: 13px;
  font-weight: 500;
}

.operation-error {
  margin: 0 0 12px;
  color: var(--van-danger-color, #ee0a24);
  font-size: 13px;
  overflow-wrap: anywhere;
}

.state-message {
  padding: 48px 16px;
  color: var(--van-text-color-2, #646566);
  text-align: center;
  font-size: 14px;
}

.error-message {
  overflow-wrap: anywhere;
  color: var(--van-danger-color, #ee0a24);
}

.recovery-entry {
  display: block;
  margin: 12px auto 0;
}

.empty-title {
  color: var(--van-text-color, #323233);
  font-size: 18px;
  font-weight: 600;
}

.list-summary {
  margin: 4px 0 12px;
  color: var(--van-text-color-2, #646566);
  font-size: 13px;
}

.group-card {
  margin-bottom: 12px;
  overflow: hidden;
  border-radius: 8px;
  background: var(--van-background-2, #fff);
}

.group-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 12px 8px;
}

.group-title {
  min-width: 0;
  font-size: 16px;
  font-weight: 600;
  overflow-wrap: anywhere;
}

.group-count {
  flex-shrink: 0;
  color: var(--van-text-color-2, #646566);
  font-size: 12px;
}

.category-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 0 12px 10px;
}

.group-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 0 12px 10px;
}

.item-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px;
  border-top: 1px solid var(--van-border-color, #ebedf0);
}

.item-main {
  min-width: 0;
  flex: 1;
}

.item-name {
  overflow-wrap: anywhere;
  font-size: 14px;
  font-weight: 500;
}

.item-note {
  margin-top: 5px;
  color: var(--van-text-color-2, #646566);
  font-size: 12px;
  overflow-wrap: anywhere;
}

.item-date {
  margin-top: 6px;
  color: var(--van-text-color-2, #646566);
  font-size: 12px;
}

.item-row-used .item-name,
.item-row-used .item-date {
  color: var(--van-text-color-3, #c8c9cc);
}

.group-expired-entry {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  padding: 10px 12px;
  border: 0;
  border-top: 1px solid var(--van-border-color, #ebedf0);
  background: #fff8f8;
  color: var(--van-danger-color, #ee0a24);
  font-size: 12px;
  font-weight: 500;
  text-align: left;
}

.group-expired-entry:active {
  background: #fff0f0;
}

.group-expired-entry__action {
  display: flex;
  align-items: center;
  gap: 2px;
}

.item-side {
  display: flex;
  flex-shrink: 0;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
}

.item-actions {
  display: flex;
  gap: 6px;
}

.dev-entry {
  margin-top: 16px;
}
</style>
