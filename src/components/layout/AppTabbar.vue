<script setup lang="ts">
import { Tabbar, TabbarItem } from 'vant'

const tabs = [
  { name: 'home', label: '首页', icon: 'home-o' },
  { name: 'categories', label: '分类管理', icon: 'apps-o' },
  { name: 'settings', label: '设置', icon: 'setting-o' },
] as const
</script>

<template>
  <Tabbar route fixed safe-area-inset-bottom class="app-tabbar">
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
