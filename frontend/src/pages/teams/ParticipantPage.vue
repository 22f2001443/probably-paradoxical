<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../../stores/authStore.js'
import DashboardShell from '../../components/common/DashboardShell.vue'
import BaseCard from '../../components/common/BaseCard.vue'
import BaseButton from '../../components/common/BaseButton.vue'
import StatusBadge from '../../components/common/StatusBadge.vue'

const auth = useAuthStore()
const router = useRouter()
const user = computed(() => auth.user ?? {})

const tiles = computed(() => [
  { label: 'Team', value: user.value.teamName || '—' },
  { label: 'Team ID', value: user.value.teamId || '—' },
])

// Competition roadmap (mirrors the backend `rounds` pipeline — Stages 0–4).
const roadmap = [
  { label: 'Stage 0 — Problem Statement Release', status: 'active', note: 'Curated paradoxes released with explanatory documents.' },
  { label: 'Stage 1 — Theme & Questionnaire Design', status: 'upcoming', note: 'Choose a paradox, build your theme, and design the questionnaire.' },
  { label: 'Stage 2 — Data Collection / Survey Phase', status: 'upcoming', note: 'Survey the campus population and submit your raw dataset.' },
  { label: 'Stage 3 — Data Cleaning & Data Analysis Phase', status: 'upcoming', note: 'Invigilated round — clean, analyse, and submit your deliverables.' },
  { label: 'Stage 4 — Final Presentation', status: 'upcoming', note: 'Present your full workflow to the judges.' },
]

const tasks = [
  { title: 'Paradoxes', desc: 'Browse all available paradoxes for the competition.', cta: 'View paradoxes', to: '/participant/paradoxes' },
  { title: 'Theme & Questionnaire', desc: 'Pick a paradox, define your real-world theme, and upload your questionnaire PDF.', cta: 'Start submission', to: '/participant/theme' },
  { title: 'Raw dataset upload', desc: 'Survey the campus, upload the raw data you collect (CSV or Excel), and sign the declaration.', cta: 'Upload dataset', to: '/participant/dataset' },
  { title: 'Analysis deliverables', desc: 'Clean and analyse the data, then submit your deliverables in the invigilated round.', when: 'Opens at Stage 3' },
  { title: 'Final presentation', desc: 'Present your full workflow and findings to the judges with a PPT.', when: 'Opens at Stage 4' },
]
</script>

<template>
  <DashboardShell eyebrow="Participant" :title="`Welcome, ${user.teamName || 'Team'}`">
    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-8">
      <BaseCard v-for="tile in tiles" :key="tile.label">
        <p class="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-1">{{ tile.label }}</p>
        <p class="text-lg font-bold text-neutral-950 break-words">{{ tile.value }}</p>
      </BaseCard>

      <button
        type="button"
        class="group text-left w-full bg-white border border-neutral-200 p-5 transition-all duration-150 hover:border-violet-400 hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-600"
        @click="router.push('/participant/results')"
      >
        <p class="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-1">Your standing</p>
        <p class="text-lg font-bold text-violet-700 group-hover:text-violet-800 break-words inline-flex items-center gap-1">
          View result
          <span aria-hidden="true">&rarr;</span>
        </p>
      </button>
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
          <BaseButton v-if="task.to" variant="primary" @click="router.push(task.to)">{{ task.cta }}</BaseButton>
          <BaseButton v-else variant="outline" :disabled="true">{{ task.when }}</BaseButton>
        </div>
      </BaseCard>
    </div>
  </DashboardShell>
</template>
