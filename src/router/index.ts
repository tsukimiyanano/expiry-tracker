import { createRouter, createWebHashHistory } from 'vue-router'
import { isDev } from '@/utils/env'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('@/views/HomeView.vue'),
    },
    {
      path: '/categories',
      name: 'categories',
      component: () => import('@/views/CategoriesView.vue'),
    },
    {
      path: '/expired-items',
      name: 'expired-items',
      component: () => import('@/views/ExpiredItemsView.vue'),
    },
    {
      path: '/data-management',
      name: 'data-management',
      component: () => import('@/views/DataManagementView.vue'),
    },
    ...(isDev()
      ? [
          {
            path: '/dev-test',
            name: 'DevTest',
            component: () => import('@/views/DevTestView.vue'),
          },
        ]
      : []),
  ],
})

export default router
