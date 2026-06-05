<script setup>
import { computed } from 'vue'
import { useAuthStore } from '../../stores/authStore.js'
import DashboardShell from '../../components/dashboard/DashboardShell.vue'
import BaseCard from '../../components/common/BaseCard.vue'
import BaseButton from '../../components/common/BaseButton.vue'
import StatusBadge from '../../components/common/StatusBadge.vue'

const auth = useAuthStore()
const user = computed(() => auth.user ?? {})

const tiles = computed(() => [
  { label: 'Team', value: user.value.teamName || '—' },
  { label: 'Team ID', value: user.value.teamId || '—' },
  { label: 'Your role', value: user.value.roleInTeam === 'leader' ? 'Team lead' : 'Member' },
  { label: 'Signed in as', value: user.value.email || '—' },
])

// Competition roadmap (mirrors the backend `rounds` pipeline).
const roadmap = [
  { label: 'Inauguration', status: 'active', note: 'Paradox statements released online.' },
  { label: 'Stage 1 — Theme & Questionnaire', status: 'upcoming', note: 'Pick a paradox, define your theme, build the questionnaire.' },
  { label: 'Stage 1 Selection', status: 'upcoming', note: 'External judges score; results published.' },
  { label: 'Data Collection', status: 'upcoming', note: 'Field your questionnaire and upload the dataset.' },
  { label: 'Data Analysis', status: 'upcoming', note: 'Proctored round — submit your analysis artifact.' },
]

const tasks = [
  { title: 'Paradox & Theme', desc: 'Select a paradox and submit your real-world theme and target population.', when: 'Opens at Stage 1' },
  { title: 'Questionnaire', desc: 'Build the questionnaire your team will field on campus.', when: 'Opens at Stage 1' },
  { title: 'Dataset upload', desc: 'Upload the data you collect — CSV or Excel.', when: 'Opens at Data Collection' },
  { title: 'Analysis artifact', desc: 'Submit your analysis as a single ZIP in the proctored round.', when: 'Opens at Analysis' },
]
</script>

<template>
  <DashboardShell eyebrow="Participant" :title="`Welcome, ${user.teamName || 'Team'}`">
    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
      <BaseCard v-for="tile in tiles" :key="tile.label">
        <p class="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-1">{{ tile.label }}</p>
        <p class="text-lg font-bold text-neutral-950 break-words">{{ tile.value }}</p>
      </BaseCard>
    </div>

    <BaseCard class="mb-8">
      <h2 class="text-lg font-bold text-neutral-950 mb-4">Competition roadmap</h2>
      <ol class="relative border-l border-neutral-200 ml-2">
        <li v-for="(step, i) in roadmap" :key="i" class="ml-5 pb-5 last:pb-0">
          <span
            class="absolute -left-1.5 mt-1 w-3 h-3 rounded-full border-2 border-white"
            :class="step.status === 'active' ? 'bg-violet-600' : 'bg-neutral-300'"
          />
          <div class="flex flex-wrap items-center gap-2">
            <span class="text-sm font-semibold text-neutral-950">{{ step.label }}</span>
            <StatusBadge :status="step.status" />
          </div>
          <p class="text-sm text-neutral-500 mt-0.5">{{ step.note }}</p>
        </li>
      </ol>
    </BaseCard>

    <h2 class="text-lg font-bold text-neutral-950 mb-3">Your deliverables</h2>
    <div class="grid gap-4 sm:grid-cols-2">
      <BaseCard v-for="task in tasks" :key="task.title" class="flex flex-col">
        <h3 class="font-bold text-neutral-950 mb-1">{{ task.title }}</h3>
        <p class="text-sm text-neutral-500 flex-1">{{ task.desc }}</p>
        <div class="mt-4">
          <BaseButton variant="outline" :disabled="true">{{ task.when }}</BaseButton>
        </div>
      </BaseCard>
    </div>
  </DashboardShell>
</template>
