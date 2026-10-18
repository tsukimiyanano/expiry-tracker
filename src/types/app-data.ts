import type { Category } from '@/types/category'
import type { ItemGroup } from '@/types/item-group'
import type { Item } from '@/types/item'

export interface AppData {
  version: number
  groups: ItemGroup[]
  items: Item[]
  categories: Category[]
}
