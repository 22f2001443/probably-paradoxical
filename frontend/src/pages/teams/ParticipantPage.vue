<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../../stores/authStore.js'
import { fetchTeamRounds, roundGate, isSubmitted, formatSubmittedAt, ROUND_KEYS } from '../../services/rounds.js'
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

// Live round states + this team's submissions, used to lock submissions whose
// round isn't open and to show what's already been submitted.
const roundsByKey = ref({})
const submissionsByKey = ref({})

// Keep the roadmap/tiles current: refetch on a timer and whenever the tab
// regains focus, so admin/cron stage transitions show without a manual reload.
const REFRESH_MS = 60000
let pollId = null

async function loadRounds() {
  try {
    const { byKey, submissions } = await fetchTeamRounds(auth.token)
    roundsByKey.value = byKey
    submissionsByKey.value = submissions
  } catch (e) {
    if (e?.status === 401) { stopRefresh(); auth.logout(); router.push('/login'); return }
    // Fail open: keep the last-known state on a transient fetch error.
  }
}

function onVisible() {
  if (document.visibilityState === 'visible') loadRounds()
}

function stopRefresh() {
  if (pollId) { clearInterval(pollId); pollId = null }
  document.removeEventListener('visibilitychange', onVisible)
}

onMounted(() => {
  loadRounds()
  pollId = setInterval(loadRounds, REFRESH_MS)
  document.addEventListener('visibilitychange', onVisible)
})

onUnmounted(stopRefresh)

// Competition roadmap (mirrors the backend `rounds` pipeline — Stages 0–4),
// with each stage's badge driven by its live round state.
const roadmapDefs = [
  { key: ROUND_KEYS.stage0, label: 'Stage 0 — Problem Statement Release', note: 'Curated paradoxes released with explanatory documents.' },
  { key: ROUND_KEYS.stage1, label: 'Stage 1 — Theme & Questionnaire Design', note: 'Choose a paradox, build your theme, and design the questionnaire.' },
  { key: ROUND_KEYS.stage2, label: 'Stage 2 — Data Collection / Survey Phase', note: 'Survey the campus population and submit your raw dataset.' },
  { key: ROUND_KEYS.stage3, label: 'Stage 3 — Data Cleaning & Data Analysis Phase', note: 'Invigilated round — clean, analyse, and submit your deliverables.' },
  { key: ROUND_KEYS.stage4, label: 'Stage 4 — Final Presentation', note: 'Present your full workflow to the judges.' },
]

const roadmap = computed(() =>
  roadmapDefs.map((step) => ({
    label: step.label,
    note: step.note,
    status: roundsByKey.value[step.key] ? roundGate(roundsByKey.value[step.key]).status : 'upcoming',
  })),
)

// Deliverables. Submission tiles carry a roundKey and lock when their round
// isn't open; non-submission tiles (Paradoxes) stay always available.
const taskDefs = [
  { title: 'Paradoxes', desc: 'Browse all available paradoxes for the competition.', cta: 'View paradoxes', to: '/participant/paradoxes' },
  { title: 'Theme & Questionnaire', desc: 'Pick a paradox, define your real-world theme, and upload your questionnaire PDF.', cta: 'Start submission', to: '/participant/theme', roundKey: ROUND_KEYS.stage1 },
  { title: 'Raw dataset upload', desc: 'Survey the campus, upload the raw data you collect (CSV or Excel), and sign the declaration.', cta: 'Upload dataset', to: '/participant/dataset', roundKey: ROUND_KEYS.stage2 },
  { title: 'Analysis deliverables', desc: 'Submit a ZIP with your clean dataset, analysis notebook, and findings document.', cta: 'Upload analysis', to: '/participant/analysis', roundKey: ROUND_KEYS.stage3 },
  { title: 'Final presentation', desc: 'Upload your final presentation (PPT or PDF) based on your submitted findings.', cta: 'Upload presentation', to: '/participant/presentation', roundKey: ROUND_KEYS.stage4 },
]

const tasks = computed(() =>
  taskDefs.map((task) => {
    if (!task.roundKey) return { ...task, locked: false, gate: null, submitted: false, submittedAt: '' }
    const round = roundsByKey.value[task.roundKey]
    // Fail open until data loads so a fetch error never hides a live round.
    const gate = round ? roundGate(round) : { open: true, status: 'active', label: 'Open', note: '' }
    const submission = submissionsByKey.value[task.roundKey]
    const submitted = isSubmitted(submission)
    return {
      ...task,
      locked: !gate.open,
      gate,
      submitted,
      submittedAt: submitted ? formatSubmittedAt(submission.submittedAt) : '',
    }
  }),
)
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
        <div class="flex items-start justify-between gap-2 mb-1">
          <h3 class="font-bold text-neutral-950">{{ task.title }}</h3>
          <StatusBadge v-if="task.submitted" status="submitted" />
          <StatusBadge v-else-if="task.gate && !task.gate.open" :status="task.gate.status" />
        </div>
        <p class="text-sm text-neutral-500 flex-1">{{ task.desc }}</p>
        <p v-if="task.submitted" class="text-xs text-emerald-700 mt-2">
          Submitted<span v-if="task.submittedAt"> · {{ task.submittedAt }}</span>
        </p>
        <p v-else-if="task.locked" class="text-xs text-neutral-400 mt-2">{{ task.gate.note }}</p>
        <div class="mt-4">
          <BaseButton v-if="task.locked" variant="outline" :disabled="true">{{ task.gate.label }}</BaseButton>
          <BaseButton v-else variant="primary" @click="router.push(task.to)">
            {{ task.submitted ? 'Update submission' : task.cta }}
          </BaseButton>
        </div>
      </BaseCard>
    </div>
  </DashboardShell>
</template>
