<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { Button, NavBar, Tag } from 'vant'
import { useRouter } from 'vue-router'

import { useAppDataStore } from '@/stores/app-data-store'
import { ErrorUtils } from '@/utils/error'
import { isDev } from '@/utils/env'

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

const listGroups = computed(() => {
  const categoryMap = new Map(
    categories.value.map((category) => [category.id, category]),
  )

  return groups.value
    .map((group) => {
      const groupItems = items.value
        .filter((item) => item.groupId === group.id)
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

            <Tag v-if="item.isUsed" type="success">已用完</Tag>
            <Tag v-else type="default">未用完</Tag>
          </div>
        </section>
      </template>

      <div v-if="isDev()" class="dev-entry">
        <Button block @click="router.push({ name: 'DevTest' })">
          开发测试
        </Button>
      </div>
    </main>
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

.dev-entry {
  margin-top: 16px;
}
</style>
