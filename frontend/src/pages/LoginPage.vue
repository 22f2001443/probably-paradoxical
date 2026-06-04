<script setup>
import { ref } from 'vue'
import { useToast } from 'vue-toastification'
import PublicLayout from '../components/layout/PublicLayout.vue'
import BaseButton from '../components/common/BaseButton.vue'
import BaseCard from '../components/common/BaseCard.vue'

const toast    = useToast()
const teamId   = ref('')
const password = ref('')
const loading  = ref(false)

async function handleLogin() {
  if (!teamId.value || !password.value) {
    toast.error('Please enter both Team ID and password.')
    return
  }
  loading.value = true
  await new Promise(r => setTimeout(r, 800))
  loading.value = false
  toast.info('Login is not yet active. Credentials will be shared before Stage 1.')
}
</script>

<template>
  <PublicLayout>
    <section class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20 flex justify-center items-center min-h-[calc(100vh-200px)]">
      <BaseCard class="w-full max-w-md p-8 md:p-10">
        <div class="text-center mb-8">
          <h1 class="text-2xl font-bold text-neutral-950 mb-2">Team Login</h1>
          <p class="text-sm text-neutral-500">
            Use the credentials shared by the organisers to access your team dashboard.
          </p>
        </div>

        <form class="space-y-6" novalidate @submit.prevent="handleLogin">
          <div>
            <label
              for="teamId"
              class="block text-xs font-semibold uppercase tracking-widest text-neutral-600 mb-2"
            >
              Team ID
            </label>
            <input
              id="teamId"
              v-model="teamId"
              type="text"
              autocomplete="username"
              placeholder="e.g. PP26-001"
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

          <BaseButton
            variant="primary"
            :disabled="loading"
            class="w-full"
          >
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
