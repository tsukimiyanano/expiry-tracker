<script setup lang="ts">
import { NavBar } from 'vant'
import { useRouter } from 'vue-router'
import AppDataTest from '@/components/Test/AppDataTest.vue'
import NativePlugin from '@/components/Test/NativePlugin.vue'

const router = useRouter()
</script>

<template>
  <div>
    <NavBar
      title="开发测试"
      left-text="返回"
      left-arrow
      @click-left="router.back()"
    />

    <AppDataTest />

    <NativePlugin />
  </div>
</template>
