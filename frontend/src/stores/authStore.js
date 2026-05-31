import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null)
  const token = ref(null)

  const isAuthenticated = computed(() => !!token.value)

  function setUser(userData, authToken) {
    user.value = userData
    token.value = authToken
  }

  function logout() {
    user.value = null
    token.value = null
  }

  return { user, token, isAuthenticated, setUser, logout }
})
