<script setup lang="ts">
import { Cell, CellGroup, Icon, NavBar } from 'vant'
import { useRouter } from 'vue-router'

const router = useRouter()

function openDataManagement() {
  void router.push({ name: 'data-management' })
}
</script>

<template>
  <div class="settings-view">
    <NavBar title="设置" />

    <main class="settings-content">
      <section>
        <h2 class="section-title">数据</h2>

        <CellGroup inset>
          <Cell
            title="数据管理"
            label="查看数据概况、导入导出与备份恢复"
            is-link
            @click="openDataManagement"
          >
            <template #icon>
              <Icon name="orders-o" class="cell-icon" size="20" />
            </template>
          </Cell>
        </CellGroup>
      </section>
    </main>
  </div>
</template>

<style scoped>
.settings-view {
  min-height: 100%;
  background: var(--et-color-bg-page);
}

.settings-content {
  padding: 16px 0 32px;
}

.section-title {
  margin: 0 16px 12px;
  color: var(--et-color-text-hint);
  font-size: 14px;
  font-weight: 500;
}

.cell-icon {
  margin-right: 12px;
  color: var(--van-primary-color);
  align-self: center;
}
</style>
