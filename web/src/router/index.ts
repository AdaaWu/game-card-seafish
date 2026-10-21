import { createRouter, createWebHistory } from 'vue-router'

export const router = createRouter({
  history: createWebHistory(),
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
    { path: '/:pathMatch(.*)*', redirect: { name: 'title' } },
  ],
})
