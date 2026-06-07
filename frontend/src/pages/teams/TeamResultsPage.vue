<script setup>
import { ref, onMounted } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { useAuthStore } from '../../stores/authStore.js'
import { apiGet } from '../../services/api.js'
import DashboardShell from '../../components/common/DashboardShell.vue'
import BaseCard from '../../components/common/BaseCard.vue'

const auth = useAuthStore()
const router = useRouter()

const results = ref([])
const loading = ref(true)
const error = ref('')

const ROUND_TITLES = {
  stage0_release: 'Stage 0 — Problem Statement Release',
  stage1_submission: 'Stage 1 — Theme & Questionnaire Design',
  stage2_data_collection: 'Stage 2 — Data Collection / Survey Phase',
  stage3_analysis: 'Stage 3 — Data Cleaning & Data Analysis Phase',
  stage4_presentation: 'Stage 4 — Final Presentation',
}

function roundTitle(key) {
  return ROUND_TITLES[key] || key
}

async function load() {
  try {
    const data = await apiGet('/team/results', { token: auth.token })
    results.value = data.results || []
    error.value = ''
  } catch (e) {
    if (e?.status === 401) { auth.logout(); router.push('/login'); return }
    error.value = e?.message || 'Could not load results.'
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <DashboardShell eyebrow="Participant" title="Results">
    <RouterLink to="/participant" class="inline-flex items-center text-sm text-neutral-500 hover:text-neutral-950 mb-6">
      ← Back to dashboard
    </RouterLink>

    <p v-if="loading" class="text-sm text-neutral-500">Loading…</p>
    <p v-else-if="error" class="text-sm text-red-600">{{ error }}</p>
    <p v-else-if="!results.length" class="text-sm text-neutral-500">
      No results have been published yet. Check back after each round is judged.
    </p>

    <div v-else class="space-y-4">
      <BaseCard v-for="(r, i) in results" :key="i">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <h3 class="font-bold text-neutral-950">{{ roundTitle(r.roundKey) }}</h3>
          <span
            class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5"
            :class="r.outcome === 'advanced' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'"
          >
            {{ r.outcome }}
          </span>
        </div>
        <div class="mt-3 flex flex-wrap gap-6 text-sm">
          <div v-if="r.aggregateScore !== null">
            <p class="text-xs font-semibold uppercase tracking-widest text-neutral-500">Score</p>
            <p class="text-lg font-bold text-neutral-950">{{ r.aggregateScore }}</p>
          </div>
          <div v-if="r.rank !== null">
            <p class="text-xs font-semibold uppercase tracking-widest text-neutral-500">Rank</p>
            <p class="text-lg font-bold text-neutral-950">#{{ r.rank }}</p>
          </div>
        </div>
        <p v-if="r.summary" class="mt-3 text-sm text-neutral-700 whitespace-pre-line">{{ r.summary }}</p>
      </BaseCard>
    </div>
  </DashboardShell>
</template>
