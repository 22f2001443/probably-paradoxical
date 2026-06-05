import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { apiPost } from '../services/api.js'

/** Where each backend role lands after login. */
export const ROLE_HOME = {
  admin: '/admin',
  judge: '/judge',
  team: '/participant',
}

export const useAuthStore = defineStore(
  'auth',
  () => {
    const user = ref(null)
    const token = ref(null)

    const isAuthenticated = computed(() => !!token.value)
    const role = computed(() => user.value?.role ?? null)
    const homeRoute = computed(() => ROLE_HOME[role.value] ?? '/login')

    function setSession(userData, authToken) {
      user.value = userData
      token.value = authToken
    }

    /** Authenticate against the backend; resolves with the user on success. */
    async function login(email, password) {
      const data = await apiPost('/auth/login', { email, password })
      if (!data?.token || !data?.user) {
        throw new Error('Unexpected response from the server.')
      }
      setSession(data.user, data.token)
      return data.user
    }

    /** Change the signed-in account's password (requires the current one). */
    async function changePassword(currentPassword, newPassword) {
      await apiPost(
        '/auth/change-password',
        { currentPassword, newPassword },
        { token: token.value },
      )
    }

    function logout() {
      user.value = null
      token.value = null
    }

    return { user, token, isAuthenticated, role, homeRoute, setSession, login, changePassword, logout }
  },
  {
    // Persist only the session state to sessionStorage (survives refresh,
    // cleared when the tab closes). Computed getters are not serialized.
    persist: {
      key: 'pp_auth',
      storage: sessionStorage,
      pick: ['user', 'token'],
    },
  },
)
