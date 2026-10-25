<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import {
  Button,
  Cell,
  CellGroup,
  Empty,
  Field,
  Form,
  Loading,
  NavBar,
  Popup,
  showConfirmDialog,
} from 'vant'
import type { FieldRule } from 'vant'
import { useRouter } from 'vue-router'

import { useAppDataStore } from '@/stores/app-data-store'
import { useBackButtonHandler } from '@/composables/useBackButtonHandler'
import { useUnsavedChangesGuard } from '@/composables/useUnsavedChangesGuard'
import type { Category } from '@/types/category'
import { ErrorUtils } from '@/utils/error'
import { StringUtils } from '@/utils/string'

const nameRules: FieldRule[] = [
  {
    validator: (value: string) => value.trim().length > 0,
    message: '请输入分类名称',
  },
]

const router = useRouter()
const store = useAppDataStore()

const { categories, groups, items, initialized, loading, saving, error } =
  storeToRefs(store)

const operationError = ref<string | null>(null)

const editVisible = ref(false)
const editingCategory = ref<Category | null>(null)
const editName = ref('')
const submitting = ref(false)
const editError = ref<string | null>(null)

const deletingCategoryId = ref<string | null>(null)

const busy = computed(
  () =>
    loading.value ||
    saving.value ||
    submitting.value ||
    deletingCategoryId.value !== null,
)

// 分组下物品数量索引：groupId -> count
const itemCountByGroupId = computed(() => {
  const counts = new Map<string, number>()

  for (const item of items.value) {
    counts.set(item.groupId, (counts.get(item.groupId) ?? 0) + 1)
  }

  return counts
})

// 页面展示数据，不写回 Store。
const categoryList = computed(() => {
  const counts = new Map<string, { groupCount: number; itemCount: number }>()

  for (const group of groups.value) {
    const itemCount = itemCountByGroupId.value.get(group.id) ?? 0

    for (const categoryId of group.categoryIds) {
      const count = counts.get(categoryId) ?? { groupCount: 0, itemCount: 0 }

      count.groupCount += 1
      count.itemCount += itemCount

      counts.set(categoryId, count)
    }
  }

  return categories.value
    .map((category) => ({
      ...category,
      groupCount: counts.get(category.id)?.groupCount ?? 0,
      itemCount: counts.get(category.id)?.itemCount ?? 0,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
})

const categoryCount = computed(() => categories.value.length)

function goBack() {
  if (router.options.history.state.back) {
    router.back()
  } else {
    void router.replace({ name: 'home' })
  }
}

function initialize() {
  operationError.value = null

  // 初始化失败时由 Store 保存错误状态，页面负责展示。
  void store.initialize().catch(() => undefined)
}

onMounted(() => {
  if (!initialized.value) {
    initialize()
  }
})

const { captureInitialState, confirmDiscard } = useUnsavedChangesGuard()

function getFormValues() {
  return {
    name: editName.value,
  }
}

function openEdit(category: Category) {
  if (busy.value) return

  editingCategory.value = category
  editName.value = category.name
  editError.value = null
  editVisible.value = true

  captureInitialState(getFormValues())
}

async function closeEdit() {
  if (submitting.value || store.saving) return

  if (!(await confirmDiscard(getFormValues()))) return

  editVisible.value = false
  editingCategory.value = null
  editError.value = null
}

// Android 返回键先交给弹窗处理，避免直接返回首页丢失编辑内容。
useBackButtonHandler(
  () => editVisible.value,
  () => closeEdit(),
)

async function submitEdit() {
  if (busy.value || !editingCategory.value) return

  const category = editingCategory.value
  const name = editName.value.trim()

  editError.value = null

  if (!name) {
    editError.value = '分类名称不能为空'
    return
  }

  const isDuplicate = categories.value.some(
    (item) =>
      item.id !== category.id &&
      StringUtils.normalizeName(item.name) === StringUtils.normalizeName(name),
  )

  if (isDuplicate) {
    editError.value = '已存在同名分类'
    return
  }

  // 名称没有变化，不需要写入数据文件。
  if (name === category.name) {
    closeEdit()
    return
  }

  submitting.value = true

  try {
    await store.renameCategory(category.id, name)

    // 保存成功后直接关闭，finally 再重置提交状态。
    editVisible.value = false
    editingCategory.value = null
    editError.value = null
  } catch (cause) {
    editError.value = ErrorUtils.getMessage(cause)
  } finally {
    submitting.value = false
  }
}

async function confirmDelete(category: Category, groupCount: number) {
  if (busy.value) return

  try {
    await showConfirmDialog({
      title: '删除分类',
      message:
        groupCount > 0
          ? `确定删除分类「${category.name}」吗？该分类关联了 ${groupCount} 个分组。删除后会解除这些分组的分类关联，但不会删除分组和物品。`
          : `确定删除分类「${category.name}」吗？删除后无法恢复。`,
      confirmButtonText: '删除',
      confirmButtonColor: 'var(--van-danger-color)',
    })
  } catch {
    // 用户取消操作。
    return
  }

  // 确认弹窗期间数据可能已经变化，再次检查。
  if (busy.value) return

  deletingCategoryId.value = category.id
  operationError.value = null

  try {
    await store.deleteCategory(category.id)
  } catch (cause) {
    operationError.value = ErrorUtils.getMessage(cause)
  } finally {
    deletingCategoryId.value = null
  }
}
</script>

<template>
  <NavBar title="分类管理" left-arrow @click-left="goBack" />

  <div class="categories-view">
    <div v-if="initialized" class="categories-view__summary">
      共 {{ categoryCount }} 个分类
    </div>

    <div v-if="loading && !initialized" class="categories-view__loading">
      <Loading vertical>正在加载分类...</Loading>
    </div>

    <div v-else-if="!initialized" class="categories-view__message">
      <p>{{ operationError || error || '数据尚未初始化' }}</p>
      <Button size="small" type="primary" @click="initialize"> 重试 </Button>
    </div>

    <template v-else>
      <div v-if="operationError" class="categories-view__message">
        <p>{{ operationError }}</p>
        <Button
          size="mini"
          plain
          native-type="button"
          @click="operationError = null"
        >
          关闭
        </Button>
      </div>

      <Empty
        v-if="categoryList.length === 0"
        description="暂无分类，可在新建物品时添加分类"
      />

      <CellGroup v-else inset>
        <Cell v-for="category in categoryList" :key="category.id">
          <template #title>
            <div class="category-name">{{ category.name }}</div>
          </template>

          <template #label>
            <span>
              关联 {{ category.groupCount }} 个分组 ·
              {{ category.itemCount }} 件物品
            </span>
          </template>

          <template #right-icon>
            <div class="category-actions">
              <Button
                size="small"
                plain
                type="primary"
                :disabled="busy"
                @click="openEdit(category)"
              >
                重命名
              </Button>

              <Button
                size="small"
                plain
                type="danger"
                :loading="deletingCategoryId === category.id"
                :disabled="busy && deletingCategoryId !== category.id"
                @click="confirmDelete(category, category.groupCount)"
              >
                删除
              </Button>
            </div>
          </template>
        </Cell>
      </CellGroup>
    </template>

    <Popup
      :show="editVisible"
      position="bottom"
      round
      closeable
      :close-on-click-overlay="false"
      :close-on-popstate="false"
      @click-close-icon="closeEdit"
    >
      <div class="category-editor">
        <h3>重命名分类</h3>

        <Form @submit="submitEdit">
          <Field
            v-model="editName"
            name="name"
            label="分类名称"
            maxlength="100"
            placeholder="请输入分类名称"
            :rules="nameRules"
          />

          <p v-if="editError" class="category-editor__error">
            {{ editError }}
          </p>

          <div class="category-editor__actions">
            <Button
              block
              round
              native-type="button"
              :disabled="submitting"
              @click="closeEdit"
            >
              取消
            </Button>

            <Button
              block
              round
              type="primary"
              native-type="submit"
              :loading="submitting"
              :disabled="saving && !submitting"
            >
              保存
            </Button>
          </div>
        </Form>
      </div>
    </Popup>
  </div>
</template>

<style scoped>
.categories-view {
  min-height: 100%;
  padding: var(--et-space-gutter) 0 32px;
}

.categories-view__summary {
  margin: 4px 16px 12px;
  color: var(--et-color-text-2);
  font-size: 13px;
}

.categories-view__loading {
  padding: 48px 0;
}

.categories-view__message {
  margin: 16px;
  color: var(--van-danger-color, #ee0a24);
  font-size: 14px;
  overflow-wrap: anywhere;
}

.category-name {
  font-size: 15px;
  font-weight: 500;
  overflow-wrap: anywhere;
}

.category-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: 12px;
}

.category-editor {
  padding: 20px 0 max(20px, env(safe-area-inset-bottom));
}

.category-editor h3 {
  margin: 0 48px 16px 16px;
  font-size: 18px;
}

.category-editor__error {
  margin: 12px 16px;
  color: var(--van-danger-color, #ee0a24);
  font-size: 13px;
}

.category-editor__actions {
  display: flex;
  gap: 12px;
  padding: 20px 16px 0;
}
</style>
