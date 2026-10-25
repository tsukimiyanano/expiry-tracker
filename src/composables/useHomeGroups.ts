import { computed } from 'vue'

import {
  APPROX_DAYS_PER_MONTH,
  EXPIRY_COUNTDOWN_DAY_MAX_DAYS,
  EXPIRY_COUNTDOWN_MAX_DAYS,
  EXPIRY_WARNING_DAYS,
} from '@/constants/expiry'
import { useAppDataStore } from '@/stores/app-data-store'
import type { Item } from '@/types/item'
import type { ItemGroup } from '@/types/item-group'
import type { ExpiryStatusInfo } from '@/utils/date'
import { DateUtils } from '@/utils/date'

export interface CountdownInfo {
  text: string
  tone: 'danger' | 'warning' | 'normal'
}

export interface HomeGroupItem extends Item {
  expiryStatus: ExpiryStatusInfo
  countdown: CountdownInfo | null
}

export interface HomeGroup extends ItemGroup {
  items: HomeGroupItem[]
  expiredCount: number
  categoryNames: string[]
  activeCount: number
  nearestExpireDate: string | null
}

function getCountdownInfo(
  isUsed: boolean,
  status: ExpiryStatusInfo,
): CountdownInfo | null {
  // 已用完和较远的日期不追加提示，避免信息冗余。
  if (isUsed || status.daysRemaining === null) return null

  const days = status.daysRemaining

  if (days < 0) {
    return { text: `已过期 ${Math.abs(days)} 天`, tone: 'danger' }
  }

  if (days === 0) {
    return { text: '今天到期', tone: 'danger' }
  }

  if (days === 1) {
    return { text: '明天到期', tone: 'warning' }
  }

  if (days <= EXPIRY_WARNING_DAYS) {
    return { text: `还剩 ${days} 天`, tone: 'warning' }
  }

  // 超过半年的物品只展示到期日期，不再追加倒计时。
  if (days > EXPIRY_COUNTDOWN_MAX_DAYS) return null

  // 一个月内按天提示，之后按月提示，避免「还剩 137 天」这类难以感知的数字。
  if (days <= EXPIRY_COUNTDOWN_DAY_MAX_DAYS) {
    return { text: `还剩 ${days} 天`, tone: 'normal' }
  }

  const months = Math.round(days / APPROX_DAYS_PER_MONTH)

  return { text: `还剩约 ${months} 个月`, tone: 'normal' }
}

/**
 * 首页分组视图数据
 *
 * 将物品的到期状态、倒计时文案、分组排序等展示规则集中计算，
 * 页面只消费结果，不再持有派生逻辑。
 */
export function useHomeGroups() {
  const store = useAppDataStore()

  const expiredItems = computed(() =>
    store.items
      .map((item) => ({
        ...item,
        expiryStatus: DateUtils.getExpiryStatus(item.expireDate, item.isUsed),
      }))
      .filter((item) => item.expiryStatus.status === 'expired')
      .sort((a, b) => a.expireDate.localeCompare(b.expireDate)),
  )

  const expiredGroupCount = computed(
    () => new Set(expiredItems.value.map((item) => item.groupId)).size,
  )

  const listGroups = computed<HomeGroup[]>(() => {
    const categoryMap = new Map(
      store.categories.map((category) => [category.id, category]),
    )

    return store.groups
      .map((group) => {
        const groupItems = store.items
          .filter((item) => item.groupId === group.id)
          .map((item) => {
            const expiryStatus = DateUtils.getExpiryStatus(
              item.expireDate,
              item.isUsed,
            )

            return {
              ...item,
              // 统一在数据层计算状态，模板只负责展示。
              expiryStatus,
              countdown: getCountdownInfo(item.isUsed, expiryStatus),
            }
          })
          .sort((a, b) => {
            // 未用完的物品排在前面，再按日期升序排列。
            if (a.isUsed !== b.isUsed) {
              return Number(a.isUsed) - Number(b.isUsed)
            }

            return a.expireDate.localeCompare(b.expireDate)
          })

        // 过期物品统一收进提醒条与弹层，分组列表只展示仍可查看的物品。
        const displayItems = groupItems.filter(
          (item) => item.expiryStatus.status !== 'expired',
        )
        const expiredCount = groupItems.length - displayItems.length
        const activeItems = displayItems.filter((item) => !item.isUsed)

        return {
          ...group,
          items: displayItems,
          expiredCount,
          categoryNames: group.categoryIds
            .map((id) => categoryMap.get(id)?.name)
            .filter((name): name is string => name !== undefined),
          activeCount: activeItems.length,
          nearestExpireDate: activeItems[0]?.expireDate ?? null,
        }
      })
      .sort((a, b) => {
        // 全部用完的分组沉底。
        if (a.nearestExpireDate === null) {
          return b.nearestExpireDate === null ? 0 : 1
        }

        if (b.nearestExpireDate === null) {
          return -1
        }

        return a.nearestExpireDate.localeCompare(b.nearestExpireDate)
      })
  })

  return {
    expiredItems,
    expiredGroupCount,
    listGroups,
  }
}
