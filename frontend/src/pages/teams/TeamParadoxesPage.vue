<script setup>
import { ref, onMounted } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { useAuthStore } from '../../stores/authStore.js'
import { apiGet } from '../../services/api.js'
import DashboardShell from '../../components/common/DashboardShell.vue'
import BaseCard from '../../components/common/BaseCard.vue'

const auth = useAuthStore()
const router = useRouter()

const list = ref([])
const loading = ref(true)
const error = ref('')

async function load() {
  try {
    const res = await apiGet('/paradoxes', { token: auth.token })
    list.value = res.paradoxes || []
    error.value = ''
  } catch (e) {
    if (e?.status === 401) { auth.logout(); router.push('/login'); return }
    error.value = e?.message || 'Failed to load paradoxes.'
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <DashboardShell eyebrow="Participant" title="Available paradoxes">
    <RouterLink to="/participant" class="inline-flex items-center text-sm text-neutral-500 hover:text-neutral-950 mb-6">
      ← Back to dashboard
    </RouterLink>

    <p v-if="loading" class="text-sm text-neutral-500">Loading…</p>
    <p v-else-if="error" class="text-sm text-red-600">{{ error }}</p>
    <p v-else-if="!list.length" class="text-sm text-neutral-500">No paradoxes have been published yet. Check back soon.</p>

    <template v-else>
      <p class="text-sm text-neutral-500 mb-4">
        Browse every paradox below, then pick one for your team's theme when Stage 1 opens.
      </p>
      <div class="space-y-4">
        <BaseCard v-for="(p, i) in list" :key="p.id">
          <div class="flex flex-wrap items-center gap-2">
            <span class="text-xs font-bold text-neutral-400">{{ i + 1 }}.</span>
            <span class="text-xs font-bold text-violet-700">{{ p.paradoxCode }}</span>
            <h3 class="font-bold text-neutral-950">{{ p.name }}</h3>
          </div>
          <p class="mt-2 text-sm text-neutral-700 whitespace-pre-line">{{ p.description }}</p>
          <p v-if="p.example" class="mt-2 text-sm text-neutral-500 whitespace-pre-line border-l-2 border-neutral-200 pl-3">
            <span class="font-semibold text-neutral-600">Example: </span>{{ p.example }}
          </p>
        </BaseCard>
      </div>
    </template>
  </DashboardShell>
</template>
