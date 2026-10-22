<script setup lang="ts">
import { computed, ref } from 'vue'
import { Button, Checkbox, Field, Tag } from 'vant'

import type { Category } from '@/types/category'
import { StringUtils } from '@/utils/string'

const props = defineProps<{
  modelValue: string[]
  categories: Category[]
}>()

const emit = defineEmits<{
  'update:modelValue': [names: string[]]
}>()

const searchText = ref('')

const keyword = computed(() => StringUtils.normalizeName(searchText.value))

const filteredCategories = computed(() =>
  props.categories.filter((category) =>
    StringUtils.normalizeName(category.name).includes(keyword.value),
  ),
)

const canAdd = computed(() => {
  if (!keyword.value) return false

  return (
    !props.categories.some(
      (category) => StringUtils.normalizeName(category.name) === keyword.value,
    ) &&
    !props.modelValue.some(
      (name) => StringUtils.normalizeName(name) === keyword.value,
    )
  )
})

function isSelected(name: string): boolean {
  const key = StringUtils.normalizeName(name)

  return props.modelValue.some(
    (selected) => StringUtils.normalizeName(selected) === key,
  )
}

function toggle(name: string) {
  const key = StringUtils.normalizeName(name)

  if (isSelected(name)) {
    emit(
      'update:modelValue',
      props.modelValue.filter(
        (selected) => StringUtils.normalizeName(selected) !== key,
      ),
    )
    return
  }

  emit('update:modelValue', [...props.modelValue, name.trim()])
}

function addCategory() {
  if (!canAdd.value) return

  const name = searchText.value.trim()

  emit('update:modelValue', [...props.modelValue, name])
  searchText.value = ''
}

function removeCategory(name: string) {
  const key = StringUtils.normalizeName(name)

  emit(
    'update:modelValue',
    props.modelValue.filter(
      (selected) => StringUtils.normalizeName(selected) !== key,
    ),
  )
}
</script>

<template>
  <div class="category-select">
    <div v-if="modelValue.length" class="category-select__selected">
      <Tag
        v-for="name in modelValue"
        :key="StringUtils.normalizeName(name)"
        type="primary"
        plain
        closeable
        size="medium"
        @close="removeCategory(name)"
      >
        {{ name }}
      </Tag>
    </div>

    <Field
      v-model="searchText"
      placeholder="搜索分类或输入新分类"
      clearable
      class="category-select__search"
    />

    <div class="category-select__options">
      <div
        v-for="category in filteredCategories"
        :key="category.id"
        class="category-select__option"
      >
        <Checkbox
          :model-value="isSelected(category.name)"
          shape="square"
          @update:model-value="toggle(category.name)"
        >
          {{ category.name }}
        </Checkbox>
      </div>

      <div
        v-if="filteredCategories.length === 0 && !canAdd"
        class="category-select__empty"
      >
        没有匹配的分类
      </div>
    </div>

    <Button
      v-if="canAdd"
      type="primary"
      plain
      size="small"
      icon="plus"
      native-type="button"
      class="category-select__add"
      @click="addCategory"
    >
      添加「{{ searchText.trim() }}」
    </Button>
  </div>
</template>

<style scoped>
.category-select {
  width: 100%;
  min-width: 0;
}

.category-select__selected {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
}

.category-select__search {
  padding: 8px 0;
}

.category-select__options {
  max-height: 180px;
  overflow-y: auto;
}

.category-select__option {
  padding: 10px 0;
}

.category-select__empty {
  padding: 12px 0;
  color: var(--van-text-color-3);
  font-size: 13px;
}

.category-select__add {
  margin-top: 8px;
}
</style>
