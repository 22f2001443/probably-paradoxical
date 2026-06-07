import { createRouter, createWebHashHistory } from 'vue-router'
import { useAuthStore } from '../stores/authStore.js'

const routes = [
  {
    path: '/',
    name: 'home',
    component: () => import('../pages/landing/HomePage.vue'),
    meta: { title: "Probably Paradoxical | Paradox'26 · IIT Madras" },
  },
  {
    path: '/guidelines',
    name: 'guidelines',
    component: () => import('../pages/landing/GuidelinesPage.vue'),
    meta: { title: 'Guidelines | Probably Paradoxical' },
  },
  {
    path: '/timeline',
    name: 'timeline',
    component: () => import('../pages/landing/TimelinePage.vue'),
    meta: { title: 'Timeline | Probably Paradoxical' },
  },
  {
    path: '/teams',
    name: 'teams',
    component: () => import('../pages/landing/TeamsPage.vue'),
    meta: { title: 'Teams | Probably Paradoxical' },
  },
  {
    path: '/judges',
    name: 'judges',
    component: () => import('../pages/landing/JudgesPage.vue'),
    meta: { title: 'Judges and Guests | Probably Paradoxical' },
  },
  {
    path: '/organizing-team',
    name: 'organizing-team',
    component: () => import('../pages/landing/OrganizingTeamPage.vue'),
    meta: { title: 'Organizing Team | Probably Paradoxical' },
  },
  {
    path: '/login',
    name: 'login',
    component: () => import('../pages/landing/LoginPage.vue'),
    meta: { title: 'Login | Probably Paradoxical' },
  },
  {
    path: '/participant',
    name: 'participant',
    component: () => import('../pages/teams/ParticipantPage.vue'),
    meta: { title: 'Participant Dashboard | Probably Paradoxical', requiresAuth: true, role: 'team' },
  },
  {
    path: '/participant/paradoxes',
    name: 'participant-paradoxes',
    component: () => import('../pages/teams/TeamParadoxesPage.vue'),
    meta: { title: 'Paradoxes | Probably Paradoxical', requiresAuth: true, role: 'team' },
  },
  {
    path: '/participant/theme',
    name: 'participant-theme',
    component: () => import('../pages/teams/TeamThemePage.vue'),
    meta: { title: 'Theme & Questionnaire | Probably Paradoxical', requiresAuth: true, role: 'team' },
  },
  {
    path: '/participant/dataset',
    name: 'participant-dataset',
    component: () => import('../pages/teams/TeamDatasetPage.vue'),
    meta: { title: 'Raw Dataset Upload | Probably Paradoxical', requiresAuth: true, role: 'team' },
  },
  {
    path: '/participant/analysis',
    name: 'participant-analysis',
    component: () => import('../pages/teams/TeamAnalysisPage.vue'),
    meta: { title: 'Analysis Deliverables | Probably Paradoxical', requiresAuth: true, role: 'team' },
  },
  {
    path: '/participant/presentation',
    name: 'participant-presentation',
    component: () => import('../pages/teams/TeamPresentationPage.vue'),
    meta: { title: 'Final Presentation | Probably Paradoxical', requiresAuth: true, role: 'team' },
  },
  {
    path: '/participant/team-info',
    name: 'participant-team-info',
    component: () => import('../pages/teams/TeamInfoPage.vue'),
    meta: { title: 'Team Info | Probably Paradoxical', requiresAuth: true, role: 'team' },
  },
  {
    path: '/participant/results',
    name: 'participant-results',
    component: () => import('../pages/teams/TeamResultsPage.vue'),
    meta: { title: 'Results | Probably Paradoxical', requiresAuth: true, role: 'team' },
  },
  {
    path: '/admin',
    name: 'admin',
    component: () => import('../pages/admin/AdminPage.vue'),
    meta: { title: 'Admin Dashboard | Probably Paradoxical', requiresAuth: true, role: 'admin' },
  },
  {
    path: '/admin/paradoxes',
    name: 'admin-paradoxes',
    component: () => import('../pages/admin/ParadoxesPage.vue'),
    meta: { title: 'Paradoxes | Probably Paradoxical', requiresAuth: true, role: 'admin' },
  },
  {
    path: '/admin/assignments',
    name: 'admin-assignments',
    component: () => import('../pages/admin/AssignmentsPage.vue'),
    meta: { title: 'Judge Assignments | Probably Paradoxical', requiresAuth: true, role: 'admin' },
  },
  {
    path: '/admin/results',
    name: 'admin-results',
    component: () => import('../pages/admin/ResultsPage.vue'),
    meta: { title: 'Results | Probably Paradoxical', requiresAuth: true, role: 'admin' },
  },
  {
    path: '/judge',
    name: 'judge',
    component: () => import('../pages/judge/JudgePage.vue'),
    meta: { title: 'Judge Dashboard | Probably Paradoxical', requiresAuth: true, role: 'judge' },
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('../pages/landing/NotFoundPage.vue'),
    meta: { title: 'Page Not Found | Probably Paradoxical' },
  },
]

const router = createRouter({
  history: createWebHashHistory(),
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
