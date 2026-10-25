<script setup lang="ts">
import { Icon } from 'vant'

defineProps<{
  count: number
  groupCount: number
}>()

const emit = defineEmits<{
  open: []
}>()
</script>

<template>
  <button type="button" class="expired-banner" @click="emit('open')">
    <span class="expired-banner__icon">
      <Icon name="warning-o" size="14" />
    </span>

    <span class="expired-banner__text">
      <strong>{{ count }} 件已过期</strong>
      <span>· {{ groupCount }} 个分组</span>
    </span>

    <span class="expired-banner__action">
      去处理
      <Icon name="arrow" size="12" />
    </span>
  </button>
</template>

<style scoped>
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
  color: var(--et-color-text-2);
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
</style>
