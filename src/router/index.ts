import { createRouter, createWebHashHistory } from "vue-router";
import { isDev } from "../utils/env.ts";

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: "/",
      name: "home",
      component: () => import("../views/HomeView.vue"),
    },
    {
      path: "/categories",
      name: "categories",
      component: () => import("../views/CategoriesView.vue"),
    },
    ...(isDev()
      ? [
          {
            path: "/dev-test",
            name: "DevTest",
            component: () => import("../views/DevTestView.vue"),
          },
        ]
      : []),
  ],
});

export default router;
