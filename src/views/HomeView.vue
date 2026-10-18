<script setup lang="ts">
import { useRouter } from 'vue-router'
import { Button, NavBar } from 'vant'
import { isDev } from '@/utils/env'

const router = useRouter()

function goToCategories() {
  void router.push({ name: 'categories' })
}
</script>

<template>
  <NavBar title="物品过期管理" />
  <div class="page-content">
    <p>物品列表页面</p>
    <Button type="primary" block @click="goToCategories">分类管理</Button>

    <Button
      v-if="isDev()"
      style="margin-top: 16px"
      type="primary"
      block
      @click="router.push({ name: 'DevTest' })"
    >
      开发测试
    </Button>
  </div>
</template>

<style scoped>
.page-content {
  padding: 16px;
}
</style>
