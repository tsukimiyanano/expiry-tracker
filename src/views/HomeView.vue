<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { Button, NavBar, Tag, showConfirmDialog } from 'vant'
import { useRouter } from 'vue-router'

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

      const activeItems = groupItems.filter((item) => !item.isUsed)

      return {
        ...group,
        items: groupItems,
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
    <NavBar
      title="物品过期管理"
      right-text="分类管理"
      @click-right="router.push({ name: 'categories' })"
    />

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

.saving-tip {
  margin-bottom: 8px;
  color: var(--van-text-color-2, #646566);
  font-size: 12px;
  text-align: right;
}

.create-entry {
  margin-bottom: 12px;
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
