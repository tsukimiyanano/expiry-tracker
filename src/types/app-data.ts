import type { Category } from './category'
import type { ItemGroup } from './item-group'
import type { Item } from './item'

export interface AppData {
  version: number
  groups: ItemGroup[]
  items: Item[]
  categories: Category[]
}
