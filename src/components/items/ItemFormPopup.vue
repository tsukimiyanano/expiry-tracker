<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Button, Field, Form, Popup, Switch } from 'vant'
import type { FieldRule } from 'vant'

import CategoryMultiSelect from '@/components/categories/CategoryMultiSelect.vue'
import { useBackButtonHandler } from '@/composables/useBackButtonHandler'
import { useUnsavedChangesGuard } from '@/composables/useUnsavedChangesGuard'
import { useAppDataStore } from '@/stores/app-data-store'
import type { Item } from '@/types/item'
import type { ItemGroup } from '@/types/item-group'
import { DateUtils } from '@/utils/date'
import { ErrorUtils } from '@/utils/error'

type FormMode = 'create' | 'add' | 'edit'

const groupNameRules: FieldRule[] = [
  {
    validator: (value: string) => value.trim().length > 0,
    message: '请输入物品名称',
  },
]

const expireDateRules: FieldRule[] = [
  {
    validator: (value: string) => DateUtils.isValidDateOnly(value),
    message: '请选择有效的到期日期',
  },
]

const props = defineProps<{
  show: boolean
  mode: FormMode
  group?: ItemGroup | null
  item?: Item | null
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
}>()

const store = useAppDataStore()

const groupName = ref('')
const categoryNames = ref<string[]>([])
const productName = ref('')
const expireDate = ref('')
const note = ref('')
const isUsed = ref(false)

const submitting = ref(false)
const submitError = ref<string | null>(null)

const title = computed(() => {
  switch (props.mode) {
    case 'create':
      return '新建物品'
    case 'add':
      return '添加同组物品'
    case 'edit':
      return '编辑物品'
  }
})

const requiresGroupName = computed(() => props.mode === 'create')

const { captureInitialState, confirmDiscard } = useUnsavedChangesGuard()

function getFormValues() {
  return {
    groupName: groupName.value,
    categoryNames: [...categoryNames.value],
    productName: productName.value,
    expireDate: expireDate.value,
    note: note.value,
    isUsed: isUsed.value,
  }
}

function resetForm() {
  groupName.value = ''
  categoryNames.value = []
  productName.value = ''
  expireDate.value = DateUtils.getTodayDateOnly()
  note.value = ''
  isUsed.value = false
  submitError.value = null

  if (props.mode === 'edit' && props.item) {
    productName.value = props.item.productName ?? ''
    expireDate.value = props.item.expireDate
    note.value = props.item.note
    isUsed.value = props.item.isUsed
  }

  captureInitialState(getFormValues())
}

watch(
  [
    () => props.show,
    () => props.mode,
    () => props.item?.id,
    () => props.group?.id,
  ],
  () => {
    if (props.show) resetForm()
  },
  { immediate: true },
)

async function close() {
  if (submitting.value || store.saving) return

  if (!(await confirmDiscard(getFormValues()))) return

  emit('update:show', false)
}

// Android 返回键先交给弹窗处理，避免直接退出应用丢失表单内容。
useBackButtonHandler(
  () => props.show,
  () => close(),
)

async function submit() {
  if (submitting.value || store.saving) return

  submitError.value = null

  if (!DateUtils.isValidDateOnly(expireDate.value)) {
    submitError.value = '请填写有效的到期日期'
    return
  }

  if (requiresGroupName.value && !groupName.value.trim()) {
    submitError.value = '请输入物品名称'
    return
  }

  submitting.value = true

  try {
    const input = {
      productName: productName.value.trim() || null,
      expireDate: expireDate.value,
      note: note.value.trim(),
    }

    switch (props.mode) {
      case 'create':
        await store.createItem({
          name: groupName.value.trim(),
          categoryNames: categoryNames.value,
          ...input,
        })
        break

      case 'add':
        if (!props.group) {
          throw new Error('未指定物品分组')
        }

        await store.addItemToGroup(props.group.id, input)
        break

      case 'edit':
        if (!props.item) {
          throw new Error('未指定需要编辑的物品')
        }

        await store.updateItem(props.item.id, {
          ...input,
          isUsed: isUsed.value,
        })
        break
    }

    emit('update:show', false)
  } catch (error) {
    submitError.value = ErrorUtils.getMessage(error)
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <Popup
    :show="show"
    position="bottom"
    round
    closeable
    :close-on-click-overlay="false"
    :close-on-popstate="false"
    :style="{ maxHeight: '90%' }"
    @click-close-icon="close"
  >
    <div class="item-form">
      <h3 class="item-form__title">{{ title }}</h3>

      <Form @submit="submit">
        <template v-if="mode === 'create'">
          <Field
            v-model="groupName"
            name="groupName"
            label="物品名称"
            placeholder="例如：牛奶"
            maxlength="100"
            :rules="groupNameRules"
          />

          <Field label="分类">
            <template #input>
              <CategoryMultiSelect
                v-model="categoryNames"
                :categories="store.categories"
              />
            </template>
          </Field>
        </template>

        <Field
          v-model="productName"
          label="规格/名称"
          placeholder="选填，例如：250ml"
          maxlength="100"
        />

        <Field
          v-model="expireDate"
          name="expireDate"
          label="到期日期"
          type="date"
          :rules="expireDateRules"
        />

        <Field
          v-model="note"
          label="备注"
          type="textarea"
          rows="2"
          autosize
          maxlength="500"
          show-word-limit
          placeholder="选填"
        />

        <Field v-if="mode === 'edit'" label="已用完">
          <template #input>
            <Switch v-model="isUsed" size="22px" />
          </template>
        </Field>

        <p v-if="submitError" class="item-form__error">
          {{ submitError }}
        </p>

        <div class="item-form__actions">
          <Button
            block
            round
            native-type="button"
            :disabled="submitting"
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
            保存
          </Button>
        </div>
      </Form>
    </div>
  </Popup>
</template>

<style scoped>
.item-form {
  padding: 20px 0 max(20px, env(safe-area-inset-bottom));
  overflow-y: auto;
}

.item-form__title {
  margin: 0 48px 16px 16px;
  font-size: 18px;
}

.item-form__error {
  margin: 12px 16px;
  color: var(--van-danger-color);
  font-size: 13px;
}

.item-form__actions {
  display: flex;
  gap: 12px;
  padding: 20px 16px 0;
}
</style>
