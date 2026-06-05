<script setup>
import { useRouter } from 'vue-router'
import { useToast } from 'vue-toastification'
import { useAuthStore } from '../../stores/authStore.js'
import PublicLayout from '../layout/PublicLayout.vue'
import BaseButton from '../common/BaseButton.vue'

defineProps({
  /** Small eyebrow label above the title (e.g. the role). */
  eyebrow: { type: String, default: '' },
  title: { type: String, default: '' },
})

const auth = useAuthStore()
const router = useRouter()
const toast = useToast()

function handleLogout() {
  auth.logout()
  toast.success('Signed out.')
  router.push('/login')
}
</script>

<template>
  <PublicLayout>
    <section class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
      <div class="flex flex-wrap items-start justify-between gap-4 mb-8">
        <div>
          <p v-if="eyebrow" class="text-xs font-semibold uppercase tracking-widest text-violet-600 mb-1">
            {{ eyebrow }}
          </p>
          <h1 class="text-2xl md:text-3xl font-bold text-neutral-950">{{ title }}</h1>
        </div>
        <div class="flex items-center gap-3">
          <span class="hidden sm:inline text-sm text-neutral-500">{{ auth.user?.email }}</span>
          <BaseButton variant="outline" @click="handleLogout">Log out</BaseButton>
        </div>
      </div>

      <slot />
    </section>
  </PublicLayout>
</template>
