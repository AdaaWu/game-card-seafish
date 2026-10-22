import { createRouter, createWebHashHistory } from 'vue-router'

export const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'title', component: () => import('@/views/TitleView.vue') },
    { path: '/menu', name: 'menu', component: () => import('@/views/MenuView.vue') },
    { path: '/story', name: 'story', component: () => import('@/views/StoryView.vue') },
    { path: '/battle', name: 'battle', component: () => import('@/views/BattleView.vue') },
    { path: '/deck', name: 'deck', component: () => import('@/views/DeckView.vue') },
    {
      path: '/battle-sandbox',
      name: 'battle-sandbox',
      component: () => import('@/components/battle/BattleSandbox.vue'),
    },
    // 元件展示頁只在開發環境提供
    ...(import.meta.env.DEV
      ? [{ path: '/ui-kit', name: 'ui-kit', component: () => import('@/components/ui/UiKitGallery.vue') }]
      : []),
    { path: '/:pathMatch(.*)*', redirect: { name: 'title' } },
  ],
})
