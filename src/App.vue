<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { RouterView, useRoute } from 'vue-router'

import AppTabbar from '@/components/layout/AppTabbar.vue'
import { useBackButtonController } from '@/composables/useBackButtonController'

// 统一接管 Android 返回键，弹窗关闭后交还系统默认行为。
useBackButtonController()

const route = useRoute()

const showTabbar = computed(() => route.meta.showTabbar === true)

interface AndroidSafeAreaBridge {
  getBottomInsetCssPx(): number
}

function applyNativeSafeArea() {
  const bridge = (
    window as unknown as { AndroidSafeArea?: AndroidSafeAreaBridge }
  ).AndroidSafeArea

  if (!bridge) return

  const bottom = Number(bridge.getBottomInsetCssPx())

  if (!Number.isFinite(bottom)) return

  document.documentElement.style.setProperty(
    '--et-safe-area-bottom',
    `${Math.max(bottom, 0)}px`,
  )
}

onMounted(() => {
  // Android 低版本 WebView 不支持 env(safe-area-inset-*)，
  // 由原生层提供导航栏高度，旋转屏幕后重新读取。
  applyNativeSafeArea()
  window.addEventListener('resize', applyNativeSafeArea)
})

onUnmounted(() => {
  window.removeEventListener('resize', applyNativeSafeArea)
})
</script>

<template>
  <div class="app-container" :class="{ 'app-container--tabbar': showTabbar }">
    <RouterView />

    <AppTabbar v-if="showTabbar" />
  </div>
</template>

<style>
*,
*::before,
*::after {
  box-sizing: border-box;
}

html,
body,
#app {
  width: 100%;
  min-height: 100%;
  margin: 0;
}

body {
  font-family:
    system-ui,
    -apple-system,
    'Segoe UI',
    sans-serif;
  background-color: var(--et-color-bg-surface);
  color: var(--et-color-text);
}

.app-container {
  padding-top: env(safe-area-inset-top, 0px);
  padding-bottom: env(safe-area-inset-bottom, 0px);
}

/* 底部导航固定悬浮，为内容预留同等高度，避免最后一段内容被遮挡。 */
.app-container--tabbar {
  padding-bottom: calc(
    var(--van-tabbar-height) + var(--et-safe-area-bottom, 0px)
  );
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
</style>
