import { computed, ref } from 'vue'
import { showConfirmDialog } from 'vant'
import type { ActionSheetAction } from 'vant'

import { useBackButtonHandler } from '@/composables/useBackButtonHandler'
import { useAppDataStore } from '@/stores/app-data-store'
import type { Item } from '@/types/item'
import type { ItemGroup } from '@/types/item-group'
import { ErrorUtils } from '@/utils/error'

export type ItemFormMode = 'create' | 'add' | 'edit'

export type ItemMenuActionKey = 'edit-item' | 'delete-item'
export type GroupMenuActionKey = 'add-item' | 'manage-group'

/**
 * 菜单操作定义
 *
 * key 为操作标识，name 为 ActionSheet 展示文案；
 * 直接把该结构传给 Vant，无需再做字段转换。
 */
export type HomeMenuAction<K extends string> = Omit<
  ActionSheetAction,
  'name'
> & {
  key: K
  name: string
}

export const ITEM_MENU_ACTIONS: HomeMenuAction<ItemMenuActionKey>[] = [
  { key: 'edit-item', name: '编辑物品', icon: 'edit' },
  {
    key: 'delete-item',
    name: '删除物品',
    icon: 'delete-o',
    color: '#ee0a24',
  },
]

export const GROUP_MENU_ACTIONS: HomeMenuAction<GroupMenuActionKey>[] = [
  { key: 'add-item', name: '添加同组物品', icon: 'plus' },
  { key: 'manage-group', name: '管理分组', icon: 'edit' },
]

function getMenuActionKey<K extends string>(
  action: ActionSheetAction,
): K | undefined {
  return (action as HomeMenuAction<K>).key
}

/**
 * 首页物品与分组的交互动作
 *
 * 统一维护表单弹窗、操作菜单与增删改状态，页面只负责绑定视图。
 */
export function useHomeActions() {
  const store = useAppDataStore()

  const itemFormVisible = ref(false)
  const itemFormMode = ref<ItemFormMode>('create')
  const selectedGroup = ref<ItemGroup | null>(null)
  const selectedItem = ref<Item | null>(null)

  const deletingItemId = ref<string | null>(null)
  const markingItemId = ref<string | null>(null)
  const operationError = ref<string | null>(null)

  const groupEditVisible = ref(false)
  const editingGroup = ref<ItemGroup | null>(null)

  const itemMenuVisible = ref(false)
  const menuItem = ref<Item | null>(null)
  const menuGroupName = ref('')

  const groupMenuVisible = ref(false)
  const menuGroup = ref<ItemGroup | null>(null)

  const editingGroupItemCount = computed(() => {
    if (!editingGroup.value) return 0

    return store.items.filter((item) => item.groupId === editingGroup.value?.id)
      .length
  })

  const itemMenuTitle = computed(() =>
    menuItem.value ? menuItem.value.productName || menuGroupName.value : '',
  )

  const groupMenuTitle = computed(() => menuGroup.value?.name ?? '')

  // 菜单弹层与表单弹层一样优先消费 Android 返回键。
  useBackButtonHandler(
    () => itemMenuVisible.value,
    () => {
      itemMenuVisible.value = false
    },
  )

  useBackButtonHandler(
    () => groupMenuVisible.value,
    () => {
      groupMenuVisible.value = false
    },
  )

  function openCreateItem() {
    if (store.saving) return

    itemFormMode.value = 'create'
    selectedGroup.value = null
    selectedItem.value = null
    itemFormVisible.value = true
  }

  function openAddItem(group: ItemGroup) {
    if (store.saving) return

    itemFormMode.value = 'add'
    selectedGroup.value = group
    selectedItem.value = null
    itemFormVisible.value = true
  }

  function openEditItem(item: Item) {
    if (store.saving) return

    itemFormMode.value = 'edit'
    selectedItem.value = item
    selectedGroup.value = null
    itemFormVisible.value = true
  }

  function openItemMenu(item: Item, groupName: string) {
    if (store.saving) return

    menuItem.value = item
    menuGroupName.value = groupName
    itemMenuVisible.value = true
  }

  function onItemMenuSelect(action: ActionSheetAction) {
    const item = menuItem.value
    if (!item) return

    const actionKey = getMenuActionKey<ItemMenuActionKey>(action)

    if (actionKey === 'edit-item') {
      openEditItem(item)
    } else if (actionKey === 'delete-item') {
      void confirmDeleteItem(item)
    }
  }

  function openGroupMenu(group: ItemGroup) {
    if (store.saving) return

    menuGroup.value = group
    groupMenuVisible.value = true
  }

  function onGroupMenuSelect(action: ActionSheetAction) {
    const group = menuGroup.value
    if (!group) return

    const actionKey = getMenuActionKey<GroupMenuActionKey>(action)

    if (actionKey === 'add-item') {
      openAddItem(group)
    } else if (actionKey === 'manage-group') {
      openEditGroup(group)
    }
  }

  async function confirmDeleteItem(item: Item) {
    if (store.saving || deletingItemId.value) return

    try {
      await showConfirmDialog({
        title: '删除物品',
        message: '确定删除这件物品吗？删除后无法恢复。',
        confirmButtonColor: 'var(--van-danger-color)',
      })
    } catch {
      // 用户取消确认，不执行删除。
      return
    }

    deletingItemId.value = item.id
    operationError.value = null

    try {
      await store.deleteItem(item.id)
    } catch (error) {
      operationError.value = ErrorUtils.getMessage(error)
    } finally {
      deletingItemId.value = null
    }
  }

  async function toggleItemUsed(item: Item) {
    if (store.saving || markingItemId.value) return

    markingItemId.value = item.id
    operationError.value = null

    try {
      await store.updateItem(item.id, { isUsed: !item.isUsed })
    } catch (error) {
      operationError.value = ErrorUtils.getMessage(error)
    } finally {
      markingItemId.value = null
    }
  }

  function openEditGroup(group: ItemGroup) {
    if (store.saving) return

    editingGroup.value = group
    groupEditVisible.value = true
  }

  return {
    itemFormVisible,
    itemFormMode,
    selectedGroup,
    selectedItem,
    groupEditVisible,
    editingGroup,
    editingGroupItemCount,
    itemMenuVisible,
    itemMenuTitle,
    groupMenuVisible,
    groupMenuTitle,
    markingItemId,
    operationError,
    openCreateItem,
    openAddItem,
    openEditItem,
    openItemMenu,
    onItemMenuSelect,
    openGroupMenu,
    onGroupMenuSelect,
    toggleItemUsed,
  }
}
