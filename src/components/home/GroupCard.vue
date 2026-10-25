<script setup lang="ts">
import { Icon } from 'vant'

import ItemRow from '@/components/home/ItemRow.vue'
import type { HomeGroup, HomeGroupItem } from '@/composables/useHomeGroups'

defineProps<{
  group: HomeGroup
  collapsed: boolean
  saving: boolean
  markingItemId: string | null
}>()

const emit = defineEmits<{
  toggle: []
  add: []
  menu: []
  'edit-item': [item: HomeGroupItem]
  'toggle-item-used': [item: HomeGroupItem]
  'item-menu': [item: HomeGroupItem, groupName: string]
  'open-expired': []
}>()
</script>

<template>
  <section class="group-card" :class="{ 'group-card--collapsed': collapsed }">
    <header class="group-header">
      <button
        type="button"
        class="group-toggle"
        :aria-expanded="!collapsed"
        @click="emit('toggle')"
      >
        <Icon
          :name="collapsed ? 'arrow' : 'arrow-down'"
          size="12"
          class="group-caret"
        />

        <span class="group-title">{{ group.name }}</span>

        <span
          v-if="collapsed && group.expiredCount > 0"
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
        @click="emit('add')"
      >
        <Icon name="plus" size="16" />
      </button>

      <button
        type="button"
        class="group-more"
        aria-label="分组操作"
        :disabled="saving"
        @click="emit('menu')"
      >
        <Icon name="ellipsis" size="18" />
      </button>
    </header>

    <div v-if="!collapsed" class="group-body">
      <div v-if="group.categoryNames.length > 0" class="group-categories">
        <span
          v-for="name in group.categoryNames"
          :key="name"
          class="category-chip"
        >
          {{ name }}
        </span>
      </div>

      <ItemRow
        v-for="item in group.items"
        :key="item.id"
        :item="item"
        :group-name="group.name"
        :saving="saving"
        :marking="markingItemId === item.id"
        @toggle-used="emit('toggle-item-used', $event)"
        @edit="emit('edit-item', $event)"
        @menu="emit('item-menu', $event, group.name)"
      />

      <button
        v-if="group.expiredCount > 0"
        type="button"
        class="group-expired-entry"
        @click="emit('open-expired')"
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

<style scoped>
.group-card {
  margin-bottom: 10px;
  overflow: hidden;
  border-radius: 14px;
  background: var(--et-color-bg-surface);
  box-shadow: var(--et-shadow-card);
}

.group-header {
  display: flex;
  align-items: center;
  min-height: var(--et-size-tap);
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
  color: var(--et-color-text-2);
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
  background: var(--et-color-fill);
  color: var(--et-color-text-2);
  font-size: 11px;
  line-height: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.group-count {
  flex-shrink: 0;
  color: var(--et-color-text-3);
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
  color: var(--et-color-text-2);
}

.group-more:active {
  background: var(--et-color-fill);
}

.group-expired-entry {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  padding: 8px 14px;
  border: 0;
  border-top: 1px solid var(--et-color-border);
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
</style>
