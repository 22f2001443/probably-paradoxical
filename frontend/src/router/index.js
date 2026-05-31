import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'home',
    component: () => import('../pages/HomePage.vue'),
    meta: { title: "Probably Paradoxical | Paradox'26 · IIT Madras" },
  },
  {
    path: '/guidelines',
    name: 'guidelines',
    component: () => import('../pages/GuidelinesPage.vue'),
    meta: { title: 'Guidelines | Probably Paradoxical' },
  },
  {
    path: '/timeline',
    name: 'timeline',
    component: () => import('../pages/TimelinePage.vue'),
    meta: { title: 'Timeline | Probably Paradoxical' },
  },
  {
    path: '/teams',
    name: 'teams',
    component: () => import('../pages/TeamsPage.vue'),
    meta: { title: 'Teams | Probably Paradoxical' },
  },
  {
    path: '/judges',
    name: 'judges',
    component: () => import('../pages/JudgesPage.vue'),
    meta: { title: 'Judges and Guests | Probably Paradoxical' },
  },
  {
    path: '/login',
    name: 'login',
    component: () => import('../pages/LoginPage.vue'),
    meta: { title: 'Team Login | Probably Paradoxical' },
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('../pages/NotFoundPage.vue'),
    meta: { title: 'Page Not Found | Probably Paradoxical' },
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) return savedPosition
    if (to.hash) return { el: to.hash, behavior: 'smooth' }
    return { top: 0 }
  },
})

// Update document title per route
router.afterEach((to) => {
  if (to.meta?.title) {
    document.title = to.meta.title
  }
})

export default router
