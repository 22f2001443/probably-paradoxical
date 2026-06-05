<script setup>
import { ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { useToast } from 'vue-toastification'
import { navLinks } from '../../data/eventData.js'
import { useAuthStore } from '../../stores/authStore.js'

const route = useRoute()
const router = useRouter()
const toast = useToast()
const auth = useAuthStore()
const mobileOpen = ref(false)

function toggleMobile() {
  mobileOpen.value = !mobileOpen.value
}
function closeMobile() {
  mobileOpen.value = false
}
function handleLogout() {
  auth.logout()
  closeMobile()
  toast.success('Signed out.')
  router.push('/login')
}
</script>

<template>
  <header class="bg-white border-b border-neutral-200 sticky top-0 z-50">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex items-center justify-between h-14">

        <!-- Brand — smaller tracking on mobile to prevent overflow on 320px screens -->
        <RouterLink
          to="/"
          class="text-xs sm:text-sm font-bold tracking-wide sm:tracking-widest uppercase text-neutral-950 hover:text-neutral-600 transition-colors shrink-0"
          @click="closeMobile"
        >
          Probably Paradoxical
        </RouterLink>

        <!-- Desktop nav -->
        <nav class="hidden md:flex items-center gap-7" aria-label="Primary navigation">
          <RouterLink
            v-for="link in navLinks"
            :key="link.to"
            :to="link.to"
            class="text-sm font-medium transition-colors"
            :class="route.path === link.to
              ? 'text-neutral-950 border-b-2 border-neutral-950 pb-0.5'
              : 'text-neutral-500 hover:text-neutral-950'"
          >
            {{ link.label }}
          </RouterLink>
        </nav>

        <!-- Login / account + hamburger -->
        <div class="flex items-center gap-2 sm:gap-3">
          <template v-if="auth.isAuthenticated">
            <RouterLink
              :to="auth.homeRoute"
              class="hidden sm:inline-flex items-center px-4 py-2 text-sm font-semibold border border-neutral-300 text-neutral-950 rounded-sm hover:border-neutral-950 transition-colors min-h-11"
            >
              Dashboard
            </RouterLink>
            <button
              type="button"
              class="hidden sm:inline-flex items-center px-4 py-2 text-sm font-semibold bg-neutral-950 text-white rounded-sm hover:bg-neutral-800 transition-colors min-h-11"
              @click="handleLogout"
            >
              Log out
            </button>
          </template>
          <RouterLink
            v-else
            to="/login"
            class="hidden sm:inline-flex items-center px-4 py-2 text-sm font-semibold bg-neutral-950 text-white rounded-sm hover:bg-neutral-800 transition-colors min-h-11"
          >
            Sign In
          </RouterLink>

          <!-- Hamburger — enlarged touch target: 44×44 px -->
          <button
            class="md:hidden flex flex-col justify-center items-center gap-1.25 w-11 h-11 text-neutral-700 hover:text-neutral-950 -mr-1.5"
            :aria-expanded="mobileOpen"
            aria-label="Toggle navigation"
            @click="toggleMobile"
          >
            <span
              class="block w-5 h-0.5 bg-current transition-all duration-200 origin-center"
              :class="mobileOpen ? 'rotate-45 translate-y-1.75' : ''"
            />
            <span
              class="block w-5 h-0.5 bg-current transition-all duration-200"
              :class="mobileOpen ? 'opacity-0' : ''"
            />
            <span
              class="block w-5 h-0.5 bg-current transition-all duration-200 origin-center"
              :class="mobileOpen ? '-rotate-45 -translate-y-1.75' : ''"
            />
          </button>
        </div>
      </div>

      <!-- Mobile nav drawer -->
      <nav
        v-show="mobileOpen"
        class="md:hidden border-t border-neutral-100 py-2 flex flex-col"
        aria-label="Mobile navigation"
      >
        <RouterLink
          v-for="link in navLinks"
          :key="link.to"
          :to="link.to"
          class="px-3 py-3 text-sm font-medium transition-colors min-h-11 flex items-center"
          :class="route.path === link.to
            ? 'text-neutral-950 bg-neutral-100'
            : 'text-neutral-500 hover:text-neutral-950 hover:bg-neutral-50'"
          @click="closeMobile"
        >
          {{ link.label }}
        </RouterLink>
        <template v-if="auth.isAuthenticated">
          <RouterLink
            :to="auth.homeRoute"
            class="mt-2 mx-3 px-4 py-3 text-sm font-semibold border border-neutral-300 text-neutral-950 text-center hover:border-neutral-950 transition-colors min-h-11 flex items-center justify-center"
            @click="closeMobile"
          >
            Dashboard
          </RouterLink>
          <button
            type="button"
            class="mx-3 mb-2 px-4 py-3 text-sm font-semibold bg-neutral-950 text-white text-center hover:bg-neutral-800 transition-colors min-h-11 flex items-center justify-center"
            @click="handleLogout"
          >
            Log out
          </button>
        </template>
        <RouterLink
          v-else
          to="/login"
          class="mt-2 mx-3 mb-2 px-4 py-3 text-sm font-semibold bg-neutral-950 text-white text-center hover:bg-neutral-800 transition-colors min-h-11 flex items-center justify-center"
          @click="closeMobile"
        >
          Sign In
        </RouterLink>
      </nav>
    </div>
  </header>
</template>
