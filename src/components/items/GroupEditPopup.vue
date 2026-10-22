<script setup lang="ts">
import { ref, watch } from 'vue'
import { Button, Field, Form, Popup, showConfirmDialog } from 'vant'
import type { FieldRule } from 'vant'

import CategoryMultiSelect from '@/components/categories/CategoryMultiSelect.vue'
import { useAppDataStore } from '@/stores/app-data-store'
import type { ItemGroup } from '@/types/item-group'
import { ErrorUtils } from '@/utils/error'

const nameRules: FieldRule[] = [
  {
    validator: (value: string) => value.trim().length > 0,
    message: '请输入物品名称',
  },
]

const props = defineProps<{
  show: boolean
  group: ItemGroup | null
  itemCount: number
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
}>()

const store = useAppDataStore()

const name = ref('')
const categoryNames = ref<string[]>([])

const submitting = ref(false)
const operationError = ref<string | null>(null)

const busy = ref(false)

watch(
  [() => props.show, () => props.group?.id],
  () => {
    if (!props.show || !props.group) return

    name.value = props.group.name

    categoryNames.value = props.group.categoryIds
      .map(
        (id) => store.categories.find((category) => category.id === id)?.name,
      )
      .filter((value): value is string => value !== undefined)

    operationError.value = null
  },
  { immediate: true },
)

function close() {
  if (busy.value) return
  emit('update:show', false)
}

async function saveGroup() {
  if (busy.value || store.saving || !props.group) return

  const trimmedName = name.value.trim()

  if (!trimmedName) {
    operationError.value = '物品名称不能为空'
    return
  }

  busy.value = true
  submitting.value = true
  operationError.value = null

  try {
    await store.updateGroup(props.group.id, {
      name: trimmedName,
      categoryNames: categoryNames.value,
    })

    emit('update:show', false)
  } catch (error) {
    operationError.value = ErrorUtils.getMessage(error)
  } finally {
    submitting.value = false
    busy.value = false
  }
}

async function deleteGroup() {
  if (busy.value || store.saving || !props.group) return

  busy.value = true
  operationError.value = null

  try {
    await showConfirmDialog({
      title: '删除整个分组',
      message: `确定删除「${props.group.name}」吗？该分组及其全部 ${props.itemCount} 件物品将被永久删除，无法恢复。`,
      confirmButtonText: '删除',
      confirmButtonColor: 'var(--van-danger-color)',
    })
  } catch {
    busy.value = false
    return
  }

  try {
    await store.deleteGroup(props.group.id)
    emit('update:show', false)
  } catch (error) {
    operationError.value = ErrorUtils.getMessage(error)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <Popup
    :show="show"
    position="bottom"
    round
    closeable
    :close-on-click-overlay="!busy"
    :close-on-popstate="!busy"
    :style="{ maxHeight: '90%' }"
    @update:show="
      (value) => {
        if (!value) close()
      }
    "
    @click-close-icon="close"
  >
    <div class="group-form">
      <h3 class="group-form__title">编辑物品分组</h3>

      <Form @submit="saveGroup">
        <Field
          v-model="name"
          name="name"
          label="物品名称"
          maxlength="100"
          placeholder="请输入物品名称"
          :rules="nameRules"
        />

        <Field label="关联分类">
          <template #input>
            <CategoryMultiSelect
              v-model="categoryNames"
              :categories="store.categories"
            />
          </template>
        </Field>

        <p v-if="operationError" class="group-form__error">
          {{ operationError }}
        </p>

        <div class="group-form__actions">
          <Button
            block
            round
            native-type="button"
            :disabled="busy"
            @click="close"
          >
            取消
          </Button>

          <Button
            block
            round
            type="primary"
            native-type="submit"
            :loading="submitting"
            :disabled="store.saving && !submitting"
          >
            保存修改
          </Button>
        </div>

        <div class="group-form__danger">
          <Button
            block
            plain
            round
            type="danger"
            native-type="button"
            :loading="busy && !submitting"
            :disabled="busy || store.saving"
            @click="deleteGroup"
          >
            删除整个分组
          </Button>
        </div>
      </Form>
    </div>
  </Popup>
</template>

<style scoped>
.group-form {
  padding: 20px 0 max(20px, env(safe-area-inset-bottom));
  overflow-y: auto;
}

.group-form__title {
  margin: 0 48px 16px 16px;
  font-size: 18px;
}

.group-form__actions {
  display: flex;
  gap: 12px;
  padding: 20px 16px 0;
}

.group-form__danger {
  margin: 24px 16px 0;
  padding-top: 16px;
  border-top: 1px solid var(--van-border-color);
}

.group-form__error {
  margin: 12px 16px;
  color: var(--van-danger-color);
  font-size: 13px;
}
</style>
