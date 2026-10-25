<script setup lang="ts">
import { Icon, Loading } from 'vant'

import type { HomeGroupItem } from '@/composables/useHomeGroups'

defineProps<{
  item: HomeGroupItem
  groupName: string
  saving: boolean
  marking: boolean
}>()

const emit = defineEmits<{
  edit: [item: HomeGroupItem]
  menu: [item: HomeGroupItem]
  'toggle-used': [item: HomeGroupItem]
}>()
</script>

<template>
  <div class="item-row" :class="{ 'item-row--used': item.isUsed }">
    <button
      type="button"
      class="item-check"
      :aria-label="item.isUsed ? '恢复为未用完' : '标记为已用完'"
      :aria-pressed="item.isUsed"
      :disabled="saving"
      @click.stop="emit('toggle-used', item)"
    >
      <Loading v-if="marking" size="16" color="var(--et-color-text-2)" />

      <span
        v-else
        class="item-check__circle"
        :class="{ 'item-check__circle--done': item.isUsed }"
      >
        <Icon v-if="item.isUsed" name="success" size="14" />
      </span>
    </button>

    <button type="button" class="item-main" @click="emit('edit', item)">
      <span class="item-text">
        <span class="item-name">
          {{ item.productName || groupName }}
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

          <span v-if="item.note" class="item-note"> · {{ item.note }} </span>
        </span>
      </span>
    </button>

    <button
      type="button"
      class="item-more"
      aria-label="物品操作"
      :disabled="saving"
      @click="emit('menu', item)"
    >
      <Icon name="ellipsis" size="16" />
    </button>
  </div>
</template>

<style scoped>
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
  background: var(--et-color-border);
  content: '';
}

.item-check {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: var(--et-size-tap);
  height: var(--et-size-tap);
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
  border: 1.5px solid var(--et-color-text-3);
  border-radius: 50%;
  color: #fff;
  transition:
    border-color 0.15s ease,
    background-color 0.15s ease;
}

.item-check:active .item-check__circle {
  border-color: var(--et-color-text-2);
}

.item-check__circle--done {
  border-color: var(--van-success-color);
  background: var(--van-success-color);
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
  background: var(--et-color-bg-page);
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
  color: var(--et-color-text);
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
  color: var(--et-color-text-hint);
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
  color: var(--et-color-countdown-danger);
}

.item-countdown--warning {
  color: var(--et-color-countdown-warning);
}

.item-countdown--normal {
  color: var(--et-color-text-hint);
  font-weight: 400;
}

.item-note {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-row--used .item-name {
  color: var(--et-color-text-used);
  font-weight: 400;
  text-decoration: line-through;
}

.item-row--used .item-meta {
  color: var(--et-color-text-used-meta);
}

.item-more {
  position: relative;
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
  color: var(--et-color-text-2);
}

.item-more::after {
  position: absolute;
  top: 50%;
  left: 50%;
  width: var(--et-size-tap);
  height: var(--et-size-tap);
  transform: translate(-50%, -50%);
  content: '';
}

.item-more:active {
  background: var(--et-color-fill);
  color: var(--et-color-text-2);
}
</style>
