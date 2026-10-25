<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import {
  ActionSheet,
  Button,
  Icon,
  Loading,
  NavBar,
  showConfirmDialog,
} from 'vant'
import type { ActionSheetAction } from 'vant'
import { useRouter } from 'vue-router'

import DataRecoveryPopup from '@/components/data/DataRecoveryPopup.vue'
import GroupEditPopup from '@/components/items/GroupEditPopup.vue'
import ItemFormPopup from '@/components/items/ItemFormPopup.vue'
import { useBackButtonHandler } from '@/composables/useBackButtonHandler'
import { useAppDataStore } from '@/stores/app-data-store'
import type { Item } from '@/types/item'
import type { ItemGroup } from '@/types/item-group'
import type { ExpiryStatusInfo } from '@/utils/date'
import { DateUtils } from '@/utils/date'
import { ErrorUtils } from '@/utils/error'
import { isDev } from '@/utils/env'

interface CountdownInfo {
  text: string
  tone: 'danger' | 'warning'
}

const ITEM_MENU_ACTIONS: ActionSheetAction[] = [
  { name: '编辑物品', icon: 'edit' },
  { name: '删除物品', icon: 'delete-o', color: '#ee0a24' },
]

const GROUP_MENU_ACTIONS: ActionSheetAction[] = [
  { name: '添加同组物品', icon: 'plus' },
  { name: '管理分组', icon: 'edit' },
]

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
const markingItemId = ref<string | null>(null)
const operationError = ref<string | null>(null)

const groupEditVisible = ref(false)
const editingGroup = ref<ItemGroup | null>(null)

const recoveryVisible = ref(false)

const collapsedGroupIds = ref<Set<string>>(new Set())

const itemMenuVisible = ref(false)
const menuItem = ref<Item | null>(null)
const menuGroupName = ref('')

const groupMenuVisible = ref(false)
const menuGroup = ref<ItemGroup | null>(null)

const editingGroupItemCount = computed(() => {
  if (!editingGroup.value) return 0

  return items.value.filter((item) => item.groupId === editingGroup.value?.id)
    .length
})

const itemMenuTitle = computed(() =>
  menuItem.value ? menuItem.value.productName || menuGroupName.value : '',
)

const groupMenuTitle = computed(() => menuGroup.value?.name ?? '')

// 菜单弹层与表单弹层一样优先消费 Android 返回键。
useBackButtonHandler(
  () => itemMenuVisible.value,
  () => {
    itemMenuVisible.value = false
  },
)

useBackButtonHandler(
  () => groupMenuVisible.value,
  () => {
    groupMenuVisible.value = false
  },
)

function isGroupCollapsed(groupId: string): boolean {
  return collapsedGroupIds.value.has(groupId)
}

function toggleGroup(groupId: string) {
  const next = new Set(collapsedGroupIds.value)

  if (next.has(groupId)) {
    next.delete(groupId)
  } else {
    next.add(groupId)
  }

  collapsedGroupIds.value = next
}

function getCountdownInfo(
  isUsed: boolean,
  status: ExpiryStatusInfo,
): CountdownInfo | null {
  // 已用完和较远的日期不追加提示，避免信息冗余。
  if (isUsed || status.daysRemaining === null) return null

  const days = status.daysRemaining

  if (days < 0) {
    return { text: `已过期 ${Math.abs(days)} 天`, tone: 'danger' }
  }

  if (days === 0) {
    return { text: '今天到期', tone: 'danger' }
  }

  if (days === 1) {
    return { text: '明天到期', tone: 'warning' }
  }

  if (days <= 7) {
    return { text: `还剩 ${days} 天`, tone: 'warning' }
  }

  return null
}

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

function openItemMenu(item: Item, groupName: string) {
  if (saving.value) return

  menuItem.value = item
  menuGroupName.value = groupName
  itemMenuVisible.value = true
}

function onItemMenuSelect(action: ActionSheetAction) {
  const item = menuItem.value
  if (!item) return

  if (action.name === '编辑物品') {
    openEditItem(item)
  } else if (action.name === '删除物品') {
    void confirmDeleteItem(item)
  }
}

function openGroupMenu(group: ItemGroup) {
  if (saving.value) return

  menuGroup.value = group
  groupMenuVisible.value = true
}

function onGroupMenuSelect(action: ActionSheetAction) {
  const group = menuGroup.value
  if (!group) return

  if (action.name === '添加同组物品') {
    openAddItem(group)
  } else if (action.name === '管理分组') {
    openEditGroup(group)
  }
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

async function toggleItemUsed(item: Item) {
  if (saving.value || markingItemId.value) return

  markingItemId.value = item.id
  operationError.value = null

  try {
    await store.updateItem(item.id, { isUsed: !item.isUsed })
  } catch (error) {
    operationError.value = ErrorUtils.getMessage(error)
  } finally {
    markingItemId.value = null
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
        .map((item) => {
          const expiryStatus = DateUtils.getExpiryStatus(
            item.expireDate,
            item.isUsed,
          )

          return {
            ...item,
            // 统一在数据层计算状态，模板只负责展示。
            expiryStatus,
            countdown: getCountdownInfo(item.isUsed, expiryStatus),
          }
        })
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
    <NavBar>
      <template #title>
        <span class="nav-title">
          <span class="nav-title__main">物品过期管理</span>
          <span class="nav-title__sub">
            {{ groups.length }} 个分组 · {{ items.length }} 件物品
          </span>
        </span>
      </template>

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
        <p>点击右下角按钮，添加第一件物品。</p>
      </div>

      <template v-else>
        <button
          v-if="expiredItems.length > 0"
          type="button"
          class="expired-banner"
          @click="openExpiredItems()"
        >
          <span class="expired-banner__icon">
            <Icon name="warning-o" size="14" />
          </span>

          <span class="expired-banner__text">
            <strong>{{ expiredItems.length }} 件已过期</strong>
            <span>· {{ expiredGroupCount }} 个分组</span>
          </span>

          <span class="expired-banner__action">
            去处理
            <Icon name="arrow" size="12" />
          </span>
        </button>

        <section
          v-for="group in listGroups"
          :key="group.id"
          class="group-card"
          :class="{ 'group-card--collapsed': isGroupCollapsed(group.id) }"
        >
          <header class="group-header">
            <button
              type="button"
              class="group-toggle"
              :aria-expanded="!isGroupCollapsed(group.id)"
              @click="toggleGroup(group.id)"
            >
              <Icon
                :name="isGroupCollapsed(group.id) ? 'arrow' : 'arrow-down'"
                size="12"
                class="group-caret"
              />

              <span class="group-title">{{ group.name }}</span>

              <span
                v-if="isGroupCollapsed(group.id) && group.expiredCount > 0"
                class="group-expired-dot"
                aria-hidden="true"
              />

              <span class="group-count">{{ group.items.length }} 件</span>
            </button>

            <button
              type="button"
              class="group-add"
              aria-label="添加同组物品"
              :disabled="saving"
              @click="openAddItem(group)"
            >
              <Icon name="plus" size="16" />
            </button>

            <button
              type="button"
              class="group-more"
              aria-label="分组操作"
              :disabled="saving"
              @click="openGroupMenu(group)"
            >
              <Icon name="ellipsis" size="18" />
            </button>
          </header>

          <div v-if="!isGroupCollapsed(group.id)" class="group-body">
            <div v-if="group.categoryNames.length > 0" class="group-categories">
              <span
                v-for="name in group.categoryNames"
                :key="name"
                class="category-chip"
              >
                {{ name }}
              </span>
            </div>

            <div
              v-for="item in group.items"
              :key="item.id"
              class="item-row"
              :class="{ 'item-row--used': item.isUsed }"
            >
              <button
                type="button"
                class="item-check"
                :aria-label="item.isUsed ? '恢复为未用完' : '标记为已用完'"
                :aria-pressed="item.isUsed"
                :disabled="saving"
                @click.stop="toggleItemUsed(item)"
              >
                <Loading
                  v-if="markingItemId === item.id"
                  size="16"
                  color="#969799"
                />

                <span
                  v-else
                  class="item-check__circle"
                  :class="{ 'item-check__circle--done': item.isUsed }"
                >
                  <Icon v-if="item.isUsed" name="success" size="14" />
                </span>
              </button>

              <button
                type="button"
                class="item-main"
                @click="openEditItem(item)"
              >
                <span class="item-text">
                  <span class="item-name">
                    {{ item.productName || group.name }}
                  </span>

                  <span class="item-meta">
                    <span class="item-date">到期 {{ item.expireDate }}</span>

                    <span
                      v-if="item.countdown"
                      class="item-countdown"
                      :class="`item-countdown--${item.countdown.tone}`"
                    >
                      · {{ item.countdown.text }}
                    </span>

                    <span v-if="item.note" class="item-note">
                      · {{ item.note }}
                    </span>
                  </span>
                </span>
              </button>

              <button
                type="button"
                class="item-more"
                aria-label="物品操作"
                :disabled="saving"
                @click="openItemMenu(item, group.name)"
              >
                <Icon name="ellipsis" size="16" />
              </button>
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
          </div>
        </section>
      </template>

      <div v-if="isDev()" class="dev-entry">
        <Button block @click="router.push({ name: 'DevTest' })">
          开发测试
        </Button>
      </div>
    </main>

    <button
      v-if="initialized"
      type="button"
      class="fab"
      aria-label="新建物品"
      :disabled="loading || saving"
      @click="openCreateItem"
    >
      <Icon name="plus" size="24" />
    </button>

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

    <ActionSheet
      v-model:show="itemMenuVisible"
      :title="itemMenuTitle"
      :actions="ITEM_MENU_ACTIONS"
      cancel-text="取消"
      @select="onItemMenuSelect"
    />

    <ActionSheet
      v-model:show="groupMenuVisible"
      :title="groupMenuTitle"
      :actions="GROUP_MENU_ACTIONS"
      cancel-text="取消"
      @select="onGroupMenuSelect"
    />
  </div>
</template>

<style scoped>
.home-page {
  min-height: 100%;
  background: var(--van-background, #f7f8fa);
}

.home-content {
  padding: 12px 12px 96px;
}

.nav-title {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  line-height: 1.2;
}

.nav-title__main {
  color: var(--van-text-color, #323233);
  font-size: 15px;
  font-weight: 600;
}

.nav-title__sub {
  color: var(--van-text-color-2, #646566);
  font-size: 10px;
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

.expired-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  margin-bottom: 10px;
  padding: 9px 12px;
  border: 1px solid #ffd7d9;
  border-radius: 12px;
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
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #ffe1e3;
  color: var(--van-danger-color, #ee0a24);
}

.expired-banner__text {
  display: flex;
  flex: 1;
  min-width: 0;
  align-items: baseline;
  gap: 3px;
  overflow: hidden;
  color: var(--van-text-color-2, #646566);
  font-size: 12px;
  white-space: nowrap;
}

.expired-banner__text strong {
  color: var(--van-danger-color, #ee0a24);
  font-size: 13px;
  font-weight: 600;
}

.expired-banner__action {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 2px;
  color: var(--van-danger-color, #ee0a24);
  font-size: 12px;
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

.group-card {
  margin-bottom: 10px;
  overflow: hidden;
  border-radius: 14px;
  background: var(--van-background-2, #fff);
  box-shadow: 0 1px 2px rgba(17, 24, 39, 0.04);
}

.group-header {
  display: flex;
  align-items: center;
  min-height: 44px;
  padding-right: 4px;
}

.group-toggle {
  display: flex;
  flex: 1;
  align-items: center;
  gap: 6px;
  min-width: 0;
  padding: 10px 8px 10px 10px;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
}

.group-toggle:active {
  opacity: 0.7;
}

.group-caret {
  flex-shrink: 0;
  color: #969799;
}

.group-title {
  flex: 1;
  min-width: 24px;
  overflow: hidden;
  font-size: 14px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.group-expired-dot {
  flex-shrink: 0;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--van-danger-color, #ee0a24);
}

.group-categories {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 0 12px 8px 28px;
}

.category-chip {
  max-width: 100%;
  padding: 0 7px;
  overflow: hidden;
  border-radius: 999px;
  background: #f2f3f5;
  color: var(--van-text-color-2, #646566);
  font-size: 11px;
  line-height: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.group-count {
  flex-shrink: 0;
  color: var(--van-text-color-3, #c8c9cc);
  font-size: 11px;
}

.group-add {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  padding: 0;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: var(--van-primary-color, #1989fa);
}

.group-add:active {
  background: #eef5ff;
}

.group-more {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  margin-left: 2px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: #969799;
}

.group-more:active {
  background: #f2f3f5;
}

.item-row {
  position: relative;
  display: flex;
  align-items: center;
  padding-left: 4px;
}

.item-row + .item-row::before {
  position: absolute;
  top: 0;
  right: 44px;
  left: 48px;
  height: 1px;
  background: var(--van-border-color, #ebedf0);
  content: '';
}

.item-check {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 44px;
  height: 44px;
  padding: 0;
  border: 0;
  background: transparent;
}

.item-check__circle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border: 1.5px solid #c8c9cc;
  border-radius: 50%;
  color: #fff;
  transition:
    border-color 0.15s ease,
    background-color 0.15s ease;
}

.item-check:active .item-check__circle {
  border-color: #969799;
}

.item-check__circle--done {
  border-color: var(--van-success-color, #07c160);
  background: var(--van-success-color, #07c160);
}

.item-main {
  display: flex;
  flex: 1;
  min-width: 0;
  padding: 9px 2px 9px 0;
  border: 0;
  border-radius: 12px;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
}

.item-main:active {
  background: #f7f8fa;
}

.item-text {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.item-name {
  overflow: hidden;
  color: var(--van-text-color, #323233);
  font-size: 15px;
  font-weight: 500;
  line-height: 20px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-meta {
  display: flex;
  min-width: 0;
  gap: 4px;
  overflow: hidden;
  color: var(--van-text-color-2, #646566);
  font-size: 12px;
  line-height: 16px;
  white-space: nowrap;
}

.item-date {
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
}

.item-countdown {
  flex-shrink: 0;
  font-weight: 500;
}

.item-countdown--danger {
  color: #d81e06;
}

.item-countdown--warning {
  color: #d46b08;
}

.item-note {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-row--used .item-name {
  color: #9aa0a6;
  font-weight: 400;
  text-decoration: line-through;
}

.item-row--used .item-meta {
  color: #b7babf;
}

.item-more {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  margin-right: 2px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: #969799;
}

.item-more:active {
  background: #f2f3f5;
  color: var(--van-text-color-2, #646566);
}

.group-expired-entry {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  padding: 8px 14px;
  border: 0;
  border-top: 1px solid var(--van-border-color, #ebedf0);
  background: #fff8f8;
  color: var(--van-danger-color, #ee0a24);
  font: inherit;
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

.fab {
  position: fixed;
  right: 18px;
  bottom: calc(20px + env(safe-area-inset-bottom, 0px));
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 52px;
  border: 0;
  border-radius: 50%;
  background: var(--van-primary-color, #1989fa);
  color: #fff;
  box-shadow: 0 6px 18px rgba(25, 137, 250, 0.36);
  transition:
    transform 0.15s ease,
    box-shadow 0.15s ease;
}

.fab:active {
  transform: scale(0.94);
  box-shadow: 0 3px 10px rgba(25, 137, 250, 0.3);
}

.fab:disabled {
  opacity: 0.5;
  box-shadow: none;
}

.dev-entry {
  margin-top: 16px;
}
</style>
