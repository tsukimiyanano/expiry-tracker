<script setup lang="ts">
import { useRouter } from "vue-router";
import { NavBar } from "vant";

const router = useRouter();

function goBack() {
  if (router.options.history.state.back) {
    router.back();
  } else {
    void router.replace({ name: "home" });
  }
}
</script>

<template>
  <NavBar title="分类管理" left-arrow @click-left="goBack" />
  <div class="page-content">
    <p>分类管理页面</p>
  </div>
</template>

<style scoped>
.page-content {
  padding: 16px;
}
</style>
