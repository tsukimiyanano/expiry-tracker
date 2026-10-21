<script setup lang="ts">
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { Button, Cell, CellGroup, Tag } from 'vant'

import { useAppDataStore } from '@/stores/app-data-store'
import { StringUtils } from '@/utils/string'
import { useAppDataTestRunner } from '@/composables/Test/useAppDataTestRunner'

const store = useAppDataStore()

const { groups, items, categories, initialized, loading, saving, error } =
  storeToRefs(store)

const testGroupId = ref<string | null>(null)
const testItemId = ref<string | null>(null)

const disabled = computed(() => busy.value || loading.value || saving.value)

const runner = useAppDataTestRunner({
  initialize: () => store.initialize(),
  isDisabled: () => loading.value || saving.value,
})

const { busy, logs, createTestName, log, expectFailure, runTest } = runner

// assert 为断言函数（asserts condition），解构绑定缺少显式类型标注会触发
// TS2775，需单独声明。
const assert: typeof runner.assert = runner.assert

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

function testEditGroup(): Promise<void> {
  return runTest('编辑物品组及分类', async () => {
    const { group, item } = await store.createItem({
      name: createTestName('待编辑分组'),
      categoryNames: [createTestName('旧分类')],
      expireDate: '2099-12-31',
    })

    const newName = createTestName('修改后分组')
    const newCategory = createTestName('新分类')

    await store.updateGroup(group.id, {
      name: newName,
      categoryNames: [newCategory],
    })

    const updatedGroup = groups.value.find((g) => g.id === group.id)

    assert(updatedGroup !== undefined, '编辑后分组不存在')
    assert(updatedGroup.name === newName, '分组名称未更新')

    const updatedCategory = categories.value.find((category) =>
      updatedGroup.categoryIds.includes(category.id),
    )

    assert(updatedCategory?.name === newCategory, '分组分类未更新')

    // 编辑分组不应影响原有物品。
    assert(
      items.value.some((existing) => existing.id === item.id),
      '编辑分组时意外删除了物品',
    )

    testGroupId.value = group.id
    testItemId.value = item.id
  })
}

function testEditItem(): Promise<void> {
  return runTest('编辑物品字段', async () => {
    const { item } = await store.createItem({
      name: createTestName('待编辑物品'),
      expireDate: '2099-12-31',
    })

    await store.updateItem(item.id, {
      productName: '测试品牌纯牛奶',
      expireDate: '2099-11-28',
      note: '编辑测试备注',
      isUsed: true,
    })

    let updatedItem = items.value.find((existing) => existing.id === item.id)

    assert(updatedItem !== undefined, '编辑后物品不存在')
    assert(updatedItem.productName === '测试品牌纯牛奶', '产品名称未更新')
    assert(updatedItem.expireDate === '2099-11-28', '过期日期未更新')
    assert(updatedItem.note === '编辑测试备注', '备注未更新')
    assert(updatedItem.isUsed, '用完状态未更新')

    // 特别验证 false 不会被错误地当作“未提供”。
    await store.updateItem(item.id, { isUsed: false })

    updatedItem = items.value.find((existing) => existing.id === item.id)

    assert(updatedItem !== undefined && !updatedItem.isUsed, '用完状态未能重置')
    testItemId.value = item.id
  })
}

function testRenameCategory(): Promise<void> {
  return runTest('分类重命名及重复校验', async () => {
    const first = await store.createItem({
      name: createTestName('分类测试A'),
      categoryNames: [createTestName('原始分类')],
      expireDate: '2099-12-31',
    })

    const second = await store.createItem({
      name: createTestName('分类测试B'),
      categoryNames: [createTestName('目标分类')],
      expireDate: '2099-12-31',
    })

    const firstCategoryId = first.group.categoryIds[0]
    const secondCategoryId = second.group.categoryIds[0]

    assert(firstCategoryId !== undefined, '第一个分类不存在')
    assert(secondCategoryId !== undefined, '第二个分类不存在')

    const targetCategory = categories.value.find(
      (category) => category.id === secondCategoryId,
    )

    assert(targetCategory !== undefined, '找不到目标分类')

    await expectFailure(
      () => store.renameCategory(firstCategoryId, targetCategory.name),
      '重名分类应该被拒绝',
    )

    const originalCategory = categories.value.find(
      (category) => category.id === firstCategoryId,
    )

    assert(originalCategory !== undefined, '失败后原分类消失')
    assert(
      originalCategory.name !== targetCategory.name,
      '重命名失败后原分类名称被修改',
    )

    const newName = createTestName('重命名成功')
    await store.renameCategory(firstCategoryId, newName)

    assert(
      categories.value.find((category) => category.id === firstCategoryId)
        ?.name === newName,
      '分类重命名未生效',
    )
  })
}

function testDeleteItem(): Promise<void> {
  return runTest('删除单件物品', async () => {
    const { group, item: firstItem } = await store.createItem({
      name: createTestName('多物品分组'),
      expireDate: '2099-12-31',
    })

    const secondItem = await store.addItemToGroup(group.id, {
      expireDate: '2099-12-30',
    })

    await store.deleteItem(firstItem.id)

    assert(
      !items.value.some((item) => item.id === firstItem.id),
      '被删除的物品仍然存在',
    )
    assert(
      items.value.some((item) => item.id === secondItem.id),
      '删除一件物品时误删了同组物品',
    )
    assert(
      groups.value.some((existing) => existing.id === group.id),
      '分组还有物品时不应被删除',
    )
  })
}

function testDeleteLastItem(): Promise<void> {
  return runTest('删除最后一件物品', async () => {
    const { group, item } = await store.createItem({
      name: createTestName('最后一件物品'),
      expireDate: '2099-12-31',
    })

    await store.deleteItem(item.id)

    assert(
      !items.value.some((existing) => existing.id === item.id),
      '物品未删除',
    )
    assert(
      !groups.value.some((existing) => existing.id === group.id),
      '删除最后一件物品后，空分组仍然存在',
    )
  })
}

function testDeleteGroup(): Promise<void> {
  return runTest('删除物品组及关联物品', async () => {
    const { group, item: firstItem } = await store.createItem({
      name: createTestName('待删除分组'),
      categoryNames: [createTestName('删除组分类')],
      expireDate: '2099-12-31',
    })

    const secondItem = await store.addItemToGroup(group.id, {
      expireDate: '2099-12-30',
    })

    await store.deleteGroup(group.id)

    assert(
      !groups.value.some((existing) => existing.id === group.id),
      '分组未删除',
    )

    assert(
      !items.value.some(
        (item) => item.id === firstItem.id || item.id === secondItem.id,
      ),
      '删除分组后仍有其关联物品',
    )
  })
}

function testDeleteCategory(): Promise<void> {
  return runTest('删除分类及清理引用', async () => {
    const categoryName = createTestName('待删除分类')

    const { group } = await store.createItem({
      name: createTestName('分类引用分组'),
      categoryNames: [categoryName],
      expireDate: '2099-12-31',
    })

    const category = categories.value.find((existing) =>
      group.categoryIds.includes(existing.id),
    )

    assert(category !== undefined, '测试分类不存在')

    const categoryId = category.id

    await store.deleteCategory(categoryId)

    assert(
      !categories.value.some((existing) => existing.id === categoryId),
      '分类仍然存在',
    )

    assert(
      groups.value.every((existing) =>
        existing.categoryIds.every((id) => id !== categoryId),
      ),
      '仍有分组引用已删除的分类',
    )

    // 删除分类不应该顺带删除物品组或物品。
    assert(
      groups.value.some((existing) => existing.id === group.id),
      '删除分类时误删了分组',
    )
  })
}

function testInvalidMutations(): Promise<void> {
  return runTest('非法输入及失败状态保护', async () => {
    const { group, item } = await store.createItem({
      name: createTestName('异常测试物品'),
      expireDate: '2099-12-31',
    })

    const originalName = groups.value.find((g) => g.id === group.id)?.name
    const originalDate = items.value.find((i) => i.id === item.id)?.expireDate

    await expectFailure(
      () => store.updateGroup('missing-test-group-id', { name: '不应生效' }),
      '不存在的分组 ID 应该被拒绝',
    )

    await expectFailure(
      () => store.updateItem(item.id, { expireDate: '2099-02-30' }),
      '非法日期应该被拒绝',
    )

    assert(
      groups.value.find((g) => g.id === group.id)?.name === originalName,
      '异常操作意外修改了分组状态',
    )

    assert(
      items.value.find((i) => i.id === item.id)?.expireDate === originalDate,
      '非法日期导致物品状态被修改',
    )
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

      <Button block :disabled="disabled" @click="testEditGroup">
        测试编辑分组及分类
      </Button>

      <Button block :disabled="disabled" @click="testEditItem">
        测试编辑物品字段
      </Button>

      <Button block :disabled="disabled" @click="testRenameCategory">
        测试分类重命名
      </Button>

      <Button block :disabled="disabled" @click="testDeleteItem">
        测试删除单件物品
      </Button>

      <Button block :disabled="disabled" @click="testDeleteLastItem">
        测试删除最后一件物品
      </Button>

      <Button block :disabled="disabled" @click="testDeleteGroup">
        测试删除整个分组
      </Button>

      <Button block :disabled="disabled" @click="testDeleteCategory">
        测试删除分类及引用清理
      </Button>

      <Button block :disabled="disabled" @click="testInvalidMutations">
        测试非法输入及失败状态保护
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
