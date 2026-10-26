/**
 * V1 数据模型快照
 *
 * 历史版本的定义不能随当前版本更新而变化，
 * 因此这里固定 V1 JSON 的实际结构，不复用当前业务类型。
 */
export interface CategoryV1 {
  id: string
  name: string
}

export interface ItemGroupV1 {
  id: string
  name: string
  categoryIds: string[]
  createdAt: string
  updatedAt: string
}

export interface ItemV1 {
  id: string
  groupId: string
  productName: string | null
  expireDate: string // YYYY-MM-DD
  isUsed: boolean
  note: string
  createdAt: string
  updatedAt: string
}

export interface AppDataV1 {
  version: 1
  groups: ItemGroupV1[]
  items: ItemV1[]
  categories: CategoryV1[]
}
