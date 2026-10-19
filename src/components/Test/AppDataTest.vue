<script setup lang="ts">
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { Button, Cell, CellGroup, Tag } from 'vant'

import { useAppDataStore } from '@/stores/app-data-store'
import { ErrorUtils } from '@/utils/error'
import { StringUtils } from '@/utils/string'

const store = useAppDataStore()
const { groups, items, categories, initialized, loading, saving, error } =
  storeToRefs(store)

const busy = ref(false)
const testGroupId = ref<string | null>(null)
const logs = ref<string[]>([])

const disabled = computed(() => busy.value || loading.value || saving.value)

let testSequence = 0

function createTestName(prefix: string): string {
  return `[测试] ${prefix}-${Date.now()}-${++testSequence}`
}

function log(message: string): void {
  logs.value.unshift(`${new Date().toLocaleTimeString()} ${message}`)
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`验证失败：${message}`)
  }
}

async function runTest(
  name: string,
  operation: () => Promise<void>,
): Promise<void> {
  if (disabled.value) return

  busy.value = true
  log(`开始：${name}`)

  try {
    await store.initialize()
    await operation()
    log(`通过：${name}`)
  } catch (cause) {
    log(`失败：${name} - ${ErrorUtils.getMessage(cause)}`)
  } finally {
    busy.value = false
  }
}

function testInitialize(): Promise<void> {
  return runTest('初始化数据', async () => {
    assert(initialized.value, 'Store 未初始化')
    log(
      `当前数据：${groups.value.length} 个分组，` +
        `${items.value.length} 件物品，` +
        `${categories.value.length} 个分类`,
    )
  })
}

function testCreateItem(): Promise<void> {
  return runTest('创建物品', async () => {
    const name = createTestName('牛奶')

    const { group, item } = await store.createItem({
      name,
      categoryNames: ['测试食品', '测试冷藏'],
      expireDate: '2099-12-31',
      note: 'Store 集成测试',
    })

    assert(
      groups.value.some((g) => g.id === group.id),
      '分组不存在',
    )
    assert(
      items.value.some((i) => i.id === item.id),
      '物品不存在',
    )
    assert(item.groupId === group.id, '物品与分组关联错误')

    testGroupId.value = group.id
    log(`创建成功：${name}`)
  })
}

function testAddItemToGroup(): Promise<void> {
  return runTest('添加同类物品', async () => {
    const groupId = testGroupId.value

    if (!groupId) {
      throw new Error('请先执行“创建物品”测试')
    }

    const beforeGroups = groups.value.length
    const beforeItems = items.value.length

    const item = await store.addItemToGroup(groupId, {
      productName: '测试品牌纯牛奶',
      expireDate: '2099-12-30',
    })

    assert(groups.value.length === beforeGroups, '不应创建新分组')
    assert(items.value.length === beforeItems + 1, '物品数量不正确')
    assert(item.groupId === groupId, '分组关联错误')
    log(`添加成功：${item.id}`)
  })
}

function testCategoryReuse(): Promise<void> {
  return runTest('分类复用', async () => {
    const categoryName = createTestName('Category')
    const beforeCount = categories.value.length

    const first = await store.createItem({
      name: createTestName('物品A'),
      categoryNames: [categoryName, ` ${categoryName.toUpperCase()} `],
      expireDate: '2099-12-31',
    })

    const second = await store.createItem({
      name: createTestName('物品B'),
      categoryNames: [categoryName.toLowerCase()],
      expireDate: '2099-12-31',
    })

    assert(categories.value.length === beforeCount + 1, '分类应当只新增一个')

    assert(
      first.group.categoryIds.length === 1 &&
        first.group.categoryIds[0] === second.group.categoryIds[0],
      '两个分组应复用同一个分类',
    )

    const matches = categories.value.filter(
      (category) =>
        StringUtils.normalizeName(category.name) ===
        StringUtils.normalizeName(categoryName),
    )

    assert(matches.length === 1, '存在重复分类')
  })
}

function testConcurrentCreation(): Promise<void> {
  return runTest('并发创建物品', async () => {
    const beforeCount = items.value.length

    const results = await Promise.all([
      store.createItem({
        name: createTestName('并发A'),
        expireDate: '2099-12-31',
      }),
      store.createItem({
        name: createTestName('并发B'),
        expireDate: '2099-12-31',
      }),
    ])

    assert(items.value.length === beforeCount + 2, '并发新增数量错误')

    for (const { item } of results) {
      assert(
        items.value.some((existing) => existing.id === item.id),
        `找不到并发创建的物品 ${item.id}`,
      )
    }
  })
}
</script>

<template>
  <div class="app-data-test">
    <h3>AppData Store 测试</h3>

    <CellGroup inset>
      <Cell title="初始化状态">
        <template #value>
          <Tag :type="initialized ? 'success' : 'default'">
            {{ initialized ? '已初始化' : '未初始化' }}
          </Tag>
        </template>
      </Cell>
      <Cell title="分组数量" :value="String(groups.length)" />
      <Cell title="物品数量" :value="String(items.length)" />
      <Cell title="分类数量" :value="String(categories.length)" />
      <Cell title="正在保存" :value="saving ? '是' : '否'" />
      <Cell v-if="error" title="Store 错误" :label="error" />
    </CellGroup>

    <div class="actions">
      <Button block :disabled="disabled" @click="testInitialize">
        初始化 / 查看数据
      </Button>

      <Button block type="primary" :disabled="disabled" @click="testCreateItem">
        创建物品
      </Button>

      <Button
        block
        :disabled="disabled || !testGroupId"
        @click="testAddItemToGroup"
      >
        添加同类物品
      </Button>

      <Button block :disabled="disabled" @click="testCategoryReuse">
        测试分类复用
      </Button>

      <Button block :disabled="disabled" @click="testConcurrentCreation">
        测试并发新增
      </Button>
    </div>

    <h4>测试日志</h4>
    <pre class="logs">{{ logs.join('\n') || '暂无测试记录' }}</pre>
  </div>
</template>

<style scoped>
.app-data-test {
  padding: 16px 0;
}

.actions {
  display: grid;
  gap: 10px;
  margin: 16px;
}

.logs {
  margin: 12px 16px;
  padding: 12px;
  border-radius: 8px;
  background: #f5f5f5;
  font-size: 12px;
  line-height: 1.6;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
</style>
