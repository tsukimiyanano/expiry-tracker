export interface Item {
  id: string
  groupId: string
  productName: string | null
  expireDate: string // YYYY-MM-DD
  isUsed: boolean
  note: string
  createdAt: string
  updatedAt: string
}
