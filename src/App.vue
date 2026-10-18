<script setup lang="ts">
import { RouterView } from 'vue-router'
</script>

<template>
   <div class="app-container">
    <RouterView />
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
  font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
  background-color: #fff;
  color: #323233;
}

.app-container {
  padding-top: env(safe-area-inset-top, 0px);
  padding-bottom: env(safe-area-inset-bottom, 0px);
}
</style>
