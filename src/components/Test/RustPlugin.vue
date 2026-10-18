<script setup lang="ts">
import { openUrl } from '@tauri-apps/plugin-opener'

const testOpenUrl = async () => {
  try {
    await openUrl('https://www.bilibili.com')
    console.log('打开成功')
  } catch (e) {
    console.error('打开失败', e)
  }
}
</script>

<template>
  <button @click="testOpenUrl">
    测试打开 Bilibili(opener)
  </button>
</template>