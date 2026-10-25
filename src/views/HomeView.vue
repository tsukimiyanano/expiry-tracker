<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { ActionSheet, Button, Icon, NavBar } from 'vant'
import { useRouter } from 'vue-router'

import DataRecoveryPopup from '@/components/data/DataRecoveryPopup.vue'
import ExpiredItemsBanner from '@/components/home/ExpiredItemsBanner.vue'
import GroupCard from '@/components/home/GroupCard.vue'
import GroupEditPopup from '@/components/items/GroupEditPopup.vue'
import ItemFormPopup from '@/components/items/ItemFormPopup.vue'
import {
  GROUP_MENU_ACTIONS,
  ITEM_MENU_ACTIONS,
  useHomeActions,
} from '@/composables/useHomeActions'
import { useHomeGroups } from '@/composables/useHomeGroups'
import { useAppDataStore } from '@/stores/app-data-store'
import { ErrorUtils } from '@/utils/error'
import { isDev } from '@/utils/env'

const router = useRouter()
const store = useAppDataStore()

const { groups, items, initialized, loading, saving, error } =
  storeToRefs(store)

onMounted(() => {
  // 初始化失败时由 Store 保存错误状态，页面负责展示。
  void store.initialize().catch(() => undefined)
})

const errorMessage = computed(() =>
  error.value ? ErrorUtils.getMessage(error.value) : '',
)

const { expiredItems, expiredGroupCount, listGroups } = useHomeGroups()

const {
  itemFormVisible,
  itemFormMode,
  selectedGroup,
  selectedItem,
  groupEditVisible,
  editingGroup,
  editingGroupItemCount,
  itemMenuVisible,
  itemMenuTitle,
  groupMenuVisible,
  groupMenuTitle,
  markingItemId,
  operationError,
  openCreateItem,
  openAddItem,
  openEditItem,
  openItemMenu,
  onItemMenuSelect,
  openGroupMenu,
  onGroupMenuSelect,
  toggleItemUsed,
} = useHomeActions()

const recoveryVisible = ref(false)

const collapsedGroupIds = ref<Set<string>>(new Set())

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

function openDataManagement() {
  void router.push({ name: 'data-management' })
}

function openExpiredItems(groupId: string | null = null) {
  void router.push({
    name: 'expired-items',
    query: groupId ? { groupId } : {},
  })
}
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
        <ExpiredItemsBanner
          v-if="expiredItems.length > 0"
          :count="expiredItems.length"
          :group-count="expiredGroupCount"
          @open="openExpiredItems()"
        />

        <GroupCard
          v-for="group in listGroups"
          :key="group.id"
          :group="group"
          :collapsed="isGroupCollapsed(group.id)"
          :saving="saving"
          :marking-item-id="markingItemId"
          @toggle="toggleGroup(group.id)"
          @add="openAddItem(group)"
          @menu="openGroupMenu(group)"
          @edit-item="openEditItem"
          @toggle-item-used="toggleItemUsed"
          @item-menu="openItemMenu"
          @open-expired="openExpiredItems(group.id)"
        />
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
  background: var(--et-color-bg-page);
}

.home-content {
  padding: var(--et-space-gutter) var(--et-space-gutter) 96px;
}

.nav-title {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  line-height: 1.2;
}

.nav-title__main {
  color: var(--et-color-text);
  font-size: 15px;
  font-weight: 600;
}

.nav-title__sub {
  color: var(--et-color-text-2);
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
  color: var(--et-color-text-2);
  font-size: 12px;
  text-align: right;
}

.operation-error {
  margin: 0 0 12px;
  color: var(--van-danger-color, #ee0a24);
  font-size: 13px;
  overflow-wrap: anywhere;
}

.state-message {
  padding: 48px 16px;
  color: var(--et-color-text-2);
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
  color: var(--et-color-text);
  font-size: 18px;
  font-weight: 600;
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
