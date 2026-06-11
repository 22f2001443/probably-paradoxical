<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../../stores/authStore.js'
import { apiGet } from '../../services/api.js'
import DashboardShell from '../../components/common/DashboardShell.vue'
import BaseCard from '../../components/common/BaseCard.vue'
import BaseButton from '../../components/common/BaseButton.vue'
import StatCard from '../../components/common/StatCard.vue'
import RoundStatusModal from '../../components/admin/RoundStatusModal.vue'

const showRounds = ref(false)

const auth = useAuthStore()
const router = useRouter()

const data = ref(null)
const loading = ref(true)
const error = ref('')
const refreshing = ref(false)
const lastUpdated = ref(null)
const now = ref(Date.now())

let tickTimer = null

const user = computed(() => auth.user ?? {})
const counts = computed(() => data.value?.counts ?? {})
const paradoxes = computed(() => data.value?.paradoxes ?? { total: 0, published: 0 })
const currentRound = computed(() => data.value?.currentRound ?? null)

const ROUND_STATE_LABEL = {
  upcoming: 'Upcoming',
  open: 'Open',
  closed: 'Closed',
  results_published: 'Results published',
  stale: 'Stale',
}

const kpis = computed(() => [
  { value: fmt(counts.value.teams), label: 'Teams' },
  { value: fmt(counts.value.members), label: 'Members' },
  { value: fmt(counts.value.judges), label: 'Judges' },
])

const controls = computed(() => [
  { key: 'paradoxes', title: 'Paradoxes', meta: `${paradoxes.value.published}/${paradoxes.value.total} published`, desc: 'Draft and publish the paradox statements teams choose from.', action: 'Manage' },
  { key: 'rounds', title: 'Rounds', meta: currentRound.value ? `${currentRound.value.title} · ${roundState(currentRound.value.state)}` : '—', desc: 'Open and close submission windows across the five stages.', action: 'Manage' },
  { key: 'assignments', title: 'Judge assignments', meta: `${fmt(counts.value.assignments)} assignments`, desc: 'Assign judges to questionnaires for Stage 1 review.', action: 'Assign' },
  { key: 'submissions', title: 'Submissions', meta: `${fmt(counts.value.submissions)} submitted`, desc: 'Review every team\'s submitted artifacts — questionnaires, datasets, analyses, decks.', action: 'Review' },
  { key: 'results', title: 'Results', meta: `${fmt(counts.value.results)} published`, desc: 'Aggregate scores and publish advancement per round.', action: 'Publish' },
  { key: 'attendance', title: 'Attendance', meta: '3 event days', desc: 'Mark day-wise attendance for every team across the event.', action: 'Manage' },
])

const activity = computed(() => data.value?.recentActivity ?? [])
const rubric = computed(() => data.value?.rubric ?? null)
const updatedAgo = computed(() => {
  if (!lastUpdated.value) return ''
  const secs = Math.max(0, Math.round((now.value - lastUpdated.value) / 1000))
  if (secs < 5) return 'just now'
  if (secs < 60) return `${secs}s ago`
  return `${Math.floor(secs / 60)}m ago`
})

function fmt(n) {
  return n == null ? '—' : Number(n).toLocaleString()
}
function roundState(state) {
  return ROUND_STATE_LABEL[state] ?? state
}

async function load({ initial = false } = {}) {
  if (initial) loading.value = true
  else refreshing.value = true
  try {
    data.value = await apiGet('/admin/overview', { token: auth.token })
    lastUpdated.value = Date.now()
    error.value = ''
  } catch (e) {
    if (e?.status === 401) {
      auth.logout()
      router.push('/login')
      return
    }
    error.value = e?.message || 'Failed to load dashboard data.'
  } finally {
    loading.value = false
    refreshing.value = false
  }
}

onMounted(() => {
  load({ initial: true })
  // Data refreshes only via the Refresh button now — no auto-poll or focus
  // refetch. The tick just keeps the "updated Xs ago" label accurate.
  tickTimer = setInterval(() => { now.value = Date.now() }, 1000)
})
onBeforeUnmount(() => {
  clearInterval(tickTimer)
})
</script>

<template>
  <DashboardShell eyebrow="Organiser" :title="`Admin · ${user.name || user.username || 'Organiser'}`">
    <!-- Live status bar -->
    <div class="flex flex-wrap items-center justify-between gap-3 mb-6">
      <div class="flex items-center gap-2 text-sm text-neutral-500">
        <span class="relative flex h-2.5 w-2.5">
          <span class="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" :class="{ 'animate-ping': !error }" />
          <span class="relative inline-flex rounded-full h-2.5 w-2.5" :class="error ? 'bg-red-500' : 'bg-emerald-500'" />
        </span>
        <span v-if="error" class="text-red-600">{{ error }}</span>
        <span v-else-if="loading">Loading live data…</span>
        <span v-else>Updated {{ updatedAgo }}</span>
      </div>
      <BaseButton variant="ghost" :disabled="refreshing || loading" @click="load()">
        {{ refreshing ? 'Refreshing…' : 'Refresh' }}
      </BaseButton>
    </div>

    <!-- KPI tiles -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      <StatCard v-for="kpi in kpis" :key="kpi.label" :value="kpi.value" :label="kpi.label" />
      <BaseCard class="flex flex-col items-center justify-center text-center py-4">
        <span class="text-lg font-bold text-neutral-950 leading-tight">{{ currentRound?.title || '—' }}</span>
        <span class="mt-1 text-xs font-medium uppercase tracking-widest text-violet-600">{{ currentRound ? roundState(currentRound.state) : 'Current round' }}</span>
      </BaseCard>
    </div>

    <!-- Host controls (with live counts) -->
    <h2 class="text-lg font-bold text-neutral-950 mb-3">Host controls</h2>
    <div class="grid gap-4 sm:grid-cols-2">
      <BaseCard v-for="control in controls" :key="control.title" class="flex items-start justify-between gap-4">
        <div>
          <div class="flex items-center gap-2 mb-1">
            <h3 class="font-bold text-neutral-950">{{ control.title }}</h3>
            <span class="text-xs font-semibold text-neutral-500 bg-neutral-100 px-2 py-0.5">{{ control.meta }}</span>
          </div>
          <p class="text-sm text-neutral-500">{{ control.desc }}</p>
        </div>
        <BaseButton
          v-if="control.key === 'rounds'"
          variant="primary"
          class="shrink-0"
          @click="showRounds = true"
        >
          {{ control.action }}
        </BaseButton>
        <BaseButton
          v-else-if="control.key === 'paradoxes'"
          variant="primary"
          class="shrink-0"
          @click="router.push('/admin/paradoxes')"
        >
          {{ control.action }}
        </BaseButton>
        <BaseButton
          v-else-if="control.key === 'assignments'"
          variant="primary"
          class="shrink-0"
          @click="router.push('/admin/assignments')"
        >
          {{ control.action }}
        </BaseButton>
        <BaseButton
          v-else-if="control.key === 'submissions'"
          variant="primary"
          class="shrink-0"
          @click="router.push('/admin/submissions')"
        >
          {{ control.action }}
        </BaseButton>
        <BaseButton
          v-else-if="control.key === 'results'"
          variant="primary"
          class="shrink-0"
          @click="router.push('/admin/results')"
        >
          {{ control.action }}
        </BaseButton>
        <BaseButton
          v-else-if="control.key === 'attendance'"
          variant="primary"
          class="shrink-0"
          @click="router.push('/admin/attendance')"
        >
          {{ control.action }}
        </BaseButton>
        <BaseButton v-else variant="outline" :disabled="true" class="shrink-0">{{ control.action }}</BaseButton>
      </BaseCard>
    </div>

    <RoundStatusModal
      :open="showRounds"
      :rounds="data?.rounds || []"
      :current-round-key="data?.currentRoundKey"
      :schedules="data?.schedules || []"
      @close="showRounds = false"
      @updated="load()"
    />

    <!-- Scoring rubric (judging) -->
    <BaseCard v-if="rubric" class="mt-6">
      <div class="flex items-center justify-between mb-3">
        <h3 class="font-bold text-neutral-950">Scoring rubric</h3>
        <span class="text-sm font-bold text-violet-700">Total {{ rubric.total }} pts</span>
      </div>
      <ul class="divide-y divide-neutral-100">
        <li v-for="c in rubric.criteria" :key="c.key" class="flex items-center justify-between gap-3 py-2.5">
          <span class="text-sm text-neutral-700">{{ c.label }}</span>
          <span class="text-sm font-bold text-neutral-950 shrink-0">{{ c.maxScore }} pts</span>
        </li>
      </ul>
      <p class="text-xs text-neutral-400 mt-3">Questionnaires are judged against these criteria; the weighted total decides advancement.</p>
    </BaseCard>

    <!-- Activity feed -->
    <BaseCard class="mt-6">
      <h3 class="font-bold text-neutral-950 mb-3">Recent activity</h3>
      <ul v-if="activity.length" class="divide-y divide-neutral-100">
        <li v-for="(event, i) in activity" :key="i" class="flex items-center justify-between gap-3 py-2.5 text-sm">
          <span class="text-neutral-700"><span class="font-medium">{{ event.actorRole }}</span> · {{ event.action }}</span>
          <span class="text-xs text-neutral-400 shrink-0">{{ new Date(event.at).toLocaleString() }}</span>
        </li>
      </ul>
      <p v-else class="text-sm text-neutral-500">
        No activity yet. Submission, judging, and publishing events will stream here.
      </p>
    </BaseCard>
  </DashboardShell>
</template>
