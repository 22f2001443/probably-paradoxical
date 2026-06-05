<script setup>
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useToast } from 'vue-toastification'
import { useAuthStore } from '../stores/authStore.js'
import PublicLayout from '../components/layout/PublicLayout.vue'
import BaseButton from '../components/common/BaseButton.vue'
import BaseCard from '../components/common/BaseCard.vue'

const toast = useToast()
const router = useRouter()
const route = useRoute()
const auth = useAuthStore()

const email = ref('')
const password = ref('')
const loading = ref(false)

async function handleLogin() {
  if (!email.value || !password.value) {
    toast.error('Please enter both email and password.')
    return
  }

  loading.value = true
  try {
    const user = await auth.login(email.value.trim(), password.value)
    toast.success('Signed in successfully.')

    // Honour a redirect target if present, otherwise go to the role home.
    // The router guard re-routes if the target does not match the role.
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : null
    router.push(redirect || auth.homeRoute)
  } catch (error) {
    toast.error(error?.message || 'Login failed. Please try again.')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <PublicLayout>
    <section
      class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20 flex justify-center items-center min-h-[calc(100vh-200px)]"
    >
      <BaseCard class="w-full max-w-md p-8 md:p-10">
        <div class="text-center mb-8">
          <h1 class="text-2xl font-bold text-neutral-950 mb-2">Sign In</h1>
          <p class="text-sm text-neutral-500">
            Admins, judges, and team members sign in with the email and password shared by the organisers.
          </p>
        </div>

        <form class="space-y-6" novalidate @submit.prevent="handleLogin">
          <div>
            <label
              for="email"
              class="block text-xs font-semibold uppercase tracking-widest text-neutral-600 mb-2"
            >
              Email
            </label>
            <input
              id="email"
              v-model="email"
              type="email"
              autocomplete="username"
              placeholder="you@example.com"
              class="w-full border border-neutral-300 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-violet-600 focus:border-transparent min-h-11 transition-shadow"
            />
          </div>

          <div>
            <label
              for="password"
              class="block text-xs font-semibold uppercase tracking-widest text-neutral-600 mb-2"
            >
              Password
            </label>
            <input
              id="password"
              v-model="password"
              type="password"
              autocomplete="current-password"
              placeholder="••••••••"
              class="w-full border border-neutral-300 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-violet-600 focus:border-transparent min-h-11 transition-shadow"
            />
          </div>

          <BaseButton variant="primary" :disabled="loading" class="w-full">
            {{ loading ? 'Signing in…' : 'Sign In' }}
          </BaseButton>
        </form>

        <p class="mt-6 text-xs text-neutral-400 text-center">
          Don't have credentials? Contact the event organisers.
        </p>
      </BaseCard>
    </section>
  </PublicLayout>
</template>
