import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/authStore.js'

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
    meta: { title: 'Login | Probably Paradoxical' },
  },
  {
    path: '/participant',
    name: 'participant',
    component: () => import('../pages/dashboard/ParticipantPage.vue'),
    meta: { title: 'Participant Dashboard | Probably Paradoxical', requiresAuth: true, role: 'team' },
  },
  {
    path: '/admin',
    name: 'admin',
    component: () => import('../pages/dashboard/AdminPage.vue'),
    meta: { title: 'Admin Dashboard | Probably Paradoxical', requiresAuth: true, role: 'admin' },
  },
  {
    path: '/judge',
    name: 'judge',
    component: () => import('../pages/dashboard/JudgePage.vue'),
    meta: { title: 'Judge Dashboard | Probably Paradoxical', requiresAuth: true, role: 'judge' },
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

// Auth + role gating.
router.beforeEach((to) => {
  const auth = useAuthStore()

  if (to.meta?.requiresAuth) {
    if (!auth.isAuthenticated) {
      return { name: 'login', query: { redirect: to.fullPath } }
    }
    // Logged in but wrong role → send them to their own dashboard.
    if (to.meta.role && auth.role !== to.meta.role) {
      return auth.homeRoute
    }
  }

  // Already logged in → keep them off the login page.
  if (to.name === 'login' && auth.isAuthenticated) {
    return auth.homeRoute
  }
})

// Update document title per route
router.afterEach((to) => {
  if (to.meta?.title) {
    document.title = to.meta.title
  }
})

export default router
