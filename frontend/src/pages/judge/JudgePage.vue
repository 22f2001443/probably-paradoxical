<script setup>
import { computed } from 'vue'
import { useAuthStore } from '../../stores/authStore.js'
import DashboardShell from '../../components/common/DashboardShell.vue'
import BaseCard from '../../components/common/BaseCard.vue'

const auth = useAuthStore()
const user = computed(() => auth.user ?? {})

// Placeholder counts until the assignments/evaluations endpoints land.
const stats = [
  { label: 'Assigned', value: '0' },
  { label: 'Scored', value: '0' },
  { label: 'Pending', value: '0' },
]

// Mirrors the seeded `questionnaire_v1` rubric (50 points total).
const rubric = [
  { criterion: 'Relevance to paradox & theme', points: 15 },
  { criterion: 'Clarity of items', points: 15 },
  { criterion: 'Methodological soundness', points: 10 },
  { criterion: 'Originality', points: 10 },
]
const rubricTotal = computed(() => rubric.reduce((sum, r) => sum + r.points, 0))
</script>

<template>
  <DashboardShell eyebrow="Judge" :title="`Judge · ${user.name || 'Reviewer'}`">
    <div class="grid grid-cols-3 gap-4 mb-8">
      <BaseCard v-for="stat in stats" :key="stat.label" class="text-center">
        <p class="text-3xl font-bold text-neutral-950 leading-none">{{ stat.value }}</p>
        <p class="mt-1 text-xs font-semibold uppercase tracking-widest text-neutral-500">{{ stat.label }}</p>
      </BaseCard>
    </div>

    <div class="grid gap-6 lg:grid-cols-3">
      <div class="lg:col-span-2">
        <h2 class="text-lg font-bold text-neutral-950 mb-3">Your review queue</h2>
        <BaseCard>
          <div class="hidden sm:grid grid-cols-12 gap-2 pb-2 mb-2 border-b border-neutral-200 text-xs font-semibold uppercase tracking-widest text-neutral-400">
            <span class="col-span-3">Team</span>
            <span class="col-span-6">Theme</span>
            <span class="col-span-3 text-right">Status</span>
          </div>
          <div class="py-10 text-center">
            <p class="text-sm font-medium text-neutral-700">No questionnaires assigned yet</p>
            <p class="text-sm text-neutral-500 mt-1">
              Questionnaires will appear here once the organisers assign them for Stage 1 review.
            </p>
          </div>
        </BaseCard>
      </div>

      <div>
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-lg font-bold text-neutral-950">Scoring rubric</h2>
          <span class="text-sm font-bold text-violet-700">Total {{ rubricTotal }} pts</span>
        </div>
        <BaseCard>
          <ul class="divide-y divide-neutral-100">
            <li v-for="row in rubric" :key="row.criterion" class="flex items-center justify-between py-2.5 gap-3">
              <span class="text-sm text-neutral-700">{{ row.criterion }}</span>
              <span class="text-sm font-bold text-neutral-950 shrink-0">{{ row.points }} pts</span>
            </li>
          </ul>
          <p class="text-xs text-neutral-400 mt-3">Each questionnaire is scored out of {{ rubricTotal }}; the total decides advancement.</p>
        </BaseCard>
      </div>
    </div>
  </DashboardShell>
</template>
