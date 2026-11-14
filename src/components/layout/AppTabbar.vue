<script setup lang="ts">
import { Tabbar, TabbarItem } from 'vant'

const tabs = [
  { name: 'home', label: '首页', icon: 'home-o' },
  { name: 'categories', label: '分类管理', icon: 'apps-o' },
  { name: 'settings', label: '设置', icon: 'setting-o' },
] as const
</script>

<template>
  <Tabbar route fixed class="app-tabbar">
    <TabbarItem
      v-for="tab in tabs"
      :key="tab.name"
      :to="{ name: tab.name }"
      :icon="tab.icon"
      replace
    >
      {{ tab.label }}
    </TabbarItem>
  </Tabbar>
</template>

<style scoped>
/* 导航栏自身背景延伸到手势导航区，避免底部出现独立色块。 */
.app-tabbar {
  padding-bottom: var(--et-safe-area-bottom, 0px);
}
</style>
