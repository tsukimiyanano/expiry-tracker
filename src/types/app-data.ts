import { APP_DATA_VERSION } from '@/constants/app-data'
import type { Category } from '@/types/category'
import type { ItemGroup } from '@/types/item-group'
import type { Item } from '@/types/item'

export interface AppData {
  version: typeof APP_DATA_VERSION
  groups: ItemGroup[]
  items: Item[]
  categories: Category[]
}
