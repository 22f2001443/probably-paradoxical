<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { useToast } from 'vue-toastification'
import { useAuthStore } from '../../stores/authStore.js'
import { apiGet, apiPost } from '../../services/api.js'
import DashboardShell from '../../components/common/DashboardShell.vue'
import BaseCard from '../../components/common/BaseCard.vue'
import BaseButton from '../../components/common/BaseButton.vue'

const auth = useAuthStore()
const router = useRouter()
const toast = useToast()

const rounds = ref([])
const teams = ref([])
const results = ref([])
const computedScores = ref({}) // roundKey -> teamId -> { score, judges }
const rubricTotal = ref(0)
const loading = ref(true)
const error = ref('')
const busy = ref(false)

const selectedRound = ref('')
// Per-team editable state for the selected round.
const outcomes = ref({}) // teamId -> 'advanced' | 'eliminated' | ''
const scores = ref({})    // teamId -> number | ''

const ROUND_STATE_LABEL = {
  upcoming: 'Upcoming', open: 'Open', closed: 'Closed',
  results_published: 'Results published', stale: 'Stale',
}

const currentRound = computed(() => rounds.value.find((r) => r.roundKey === selectedRound.value) || null)
// Judges' computed scores for the selected round (questionnaire phase derives
// its result from these rather than manual entry).
const computedForRound = computed(() => computedScores.value[selectedRound.value] || {})
const usesJudgeScores = computed(() => Object.keys(computedForRound.value).length > 0)

// When judge-scored, list teams highest score first so advancing the top is easy.
const orderedTeams = computed(() => {
  if (!usesJudgeScores.value) return teams.value
  return [...teams.value].sort(
    (a, b) => (computedForRound.value[b.teamId]?.score ?? -1) - (computedForRound.value[a.teamId]?.score ?? -1),
  )
})

const counts = computed(() => {
  let adv = 0, elim = 0
  for (const t of teams.value) {
    if (outcomes.value[t.teamId] === 'advanced') adv++
    else if (outcomes.value[t.teamId] === 'eliminated') elim++
  }
  return { adv, elim, set: adv + elim }
})

function resultsForRound(roundKey) {
  return results.value.filter((r) => r.roundKey === roundKey)
}

// (Re)initialise the editable maps. Scores come from judges where available,
// otherwise from any previously published result.
function syncRound() {
  const map = {}, sc = {}
  for (const t of teams.value) { map[t.teamId] = ''; sc[t.teamId] = '' }
  for (const r of resultsForRound(selectedRound.value)) {
    map[r.teamId] = r.outcome
    if (r.aggregateScore != null) sc[r.teamId] = r.aggregateScore
  }
  const judgeScores = computedScores.value[selectedRound.value] || {}
  for (const [teamId, v] of Object.entries(judgeScores)) sc[teamId] = v.score
  outcomes.value = map
  scores.value = sc
}

watch(selectedRound, syncRound)

function setAll(outcome) {
  const map = { ...outcomes.value }
  for (const t of teams.value) map[t.teamId] = outcome
  outcomes.value = map
}

async function load() {
  try {
    const data = await apiGet('/admin/results', { token: auth.token })
    rounds.value = data.rounds || []
    teams.value = data.teams || []
    results.value = data.results || []
    computedScores.value = data.computedScores || {}
    rubricTotal.value = data.rubricTotal || 0
    if (!selectedRound.value && rounds.value.length) selectedRound.value = rounds.value[0].roundKey
    syncRound()
    error.value = ''
  } catch (e) {
    if (e?.status === 401) { auth.logout(); router.push('/login'); return }
    error.value = e?.message || 'Failed to load results.'
  } finally {
    loading.value = false
  }
}

async function publish() {
  const payload = teams.value
    .filter((t) => outcomes.value[t.teamId] === 'advanced' || outcomes.value[t.teamId] === 'eliminated')
    .map((t) => {
      const entry = { teamId: t.teamId, outcome: outcomes.value[t.teamId] }
      const s = scores.value[t.teamId]
      if (s !== '' && s != null && Number.isFinite(Number(s))) entry.aggregateScore = Number(s)
      return entry
    })
  if (!payload.length) { toast.error('Mark at least one team advanced or eliminated.'); return }
  if (!window.confirm(`Publish ${payload.length} result(s) for ${currentRound.value?.title}? Teams will see this immediately.`)) return

  busy.value = true
  try {
    const res = await apiPost('/admin/results/publish', { roundKey: selectedRound.value, outcomes: payload }, { token: auth.token })
    toast.success(`Published — ${res.advanced} advanced, ${res.eliminated} eliminated.`)
    await load()
  } catch (e) {
    toast.error(e?.message || 'Could not publish results.')
  } finally {
    busy.value = false
  }
}

onMounted(load)
</script>

<template>
  <DashboardShell eyebrow="Organiser" title="Results">
    <RouterLink to="/admin" class="inline-flex items-center text-sm text-neutral-500 hover:text-neutral-950 mb-6">
      ← Back to dashboard
    </RouterLink>

    <p v-if="loading" class="text-sm text-neutral-500">Loading…</p>
    <p v-else-if="error" class="text-sm text-red-600">{{ error }}</p>

    <template v-else>
      <!-- Stage selector: one publish window per stage -->
      <div class="flex flex-wrap gap-2 mb-6">
        <button
          v-for="r in rounds"
          :key="r.roundKey"
          type="button"
          class="px-3 py-2 text-sm font-semibold border transition-colors"
          :class="selectedRound === r.roundKey
            ? 'border-neutral-950 bg-neutral-950 text-white'
            : 'border-neutral-300 text-neutral-700 hover:border-neutral-950'"
          @click="selectedRound = r.roundKey"
        >
          {{ r.title }}
          <span
            v-if="r.state === 'results_published'"
            class="ml-1.5 text-[10px] font-bold uppercase tracking-wider"
            :class="selectedRound === r.roundKey ? 'text-emerald-300' : 'text-emerald-600'"
          >● published</span>
        </button>
      </div>

      <BaseCard v-if="currentRound">
        <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 class="text-lg font-bold text-neutral-950">{{ currentRound.title }}</h2>
            <p class="text-xs text-neutral-500 mt-0.5">
              Status: {{ ROUND_STATE_LABEL[currentRound.state] || currentRound.state }} ·
              {{ counts.adv }} advancing · {{ counts.elim }} eliminated · {{ teams.length }} teams
            </p>
          </div>
          <div class="flex flex-wrap gap-2">
            <BaseButton variant="ghost" :disabled="busy" @click="setAll('advanced')">Advance all</BaseButton>
            <BaseButton variant="ghost" :disabled="busy" @click="setAll('eliminated')">Eliminate all</BaseButton>
            <BaseButton variant="ghost" :disabled="busy" @click="setAll('')">Clear</BaseButton>
            <BaseButton variant="primary" :disabled="busy || counts.set === 0" @click="publish">
              {{ busy ? 'Publishing…' : 'Publish results' }}
            </BaseButton>
          </div>
        </div>

        <p v-if="usesJudgeScores" class="text-xs text-neutral-500 mb-3">
          Scores below are the judges' weighted averages out of {{ rubricTotal }} (teams ordered by score).
        </p>
        <div class="divide-y divide-neutral-100">
          <div
            v-for="t in orderedTeams"
            :key="t.teamId"
            class="flex flex-wrap items-center justify-between gap-3 py-2.5"
          >
            <div class="flex items-center gap-2 min-w-0">
              <span class="text-xs font-bold text-neutral-400 shrink-0">{{ t.teamId }}</span>
              <span class="text-sm font-medium text-neutral-950 truncate">{{ t.teamName }}</span>
              <span
                v-if="t.status === 'eliminated'"
                class="text-[10px] font-bold uppercase tracking-wider text-red-600 shrink-0"
              >out</span>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <!-- Judge-derived score (read-only) or manual entry -->
              <span
                v-if="usesJudgeScores"
                class="text-sm font-semibold w-28 text-right"
                :class="computedForRound[t.teamId] ? 'text-neutral-950' : 'text-neutral-400'"
              >
                <template v-if="computedForRound[t.teamId]">
                  {{ computedForRound[t.teamId].score }}/{{ rubricTotal }}
                  <span class="text-xs font-normal text-neutral-400">({{ computedForRound[t.teamId].judges }})</span>
                </template>
                <template v-else>no score</template>
              </span>
              <input
                v-else
                v-model="scores[t.teamId]"
                type="number"
                step="any"
                placeholder="score"
                class="w-20 border border-neutral-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-violet-600"
              />
              <div class="inline-flex border border-neutral-300">
                <button
                  type="button"
                  class="px-3 py-1 text-sm font-semibold transition-colors"
                  :class="outcomes[t.teamId] === 'advanced' ? 'bg-emerald-600 text-white' : 'text-neutral-600 hover:bg-neutral-100'"
                  @click="outcomes[t.teamId] = outcomes[t.teamId] === 'advanced' ? '' : 'advanced'"
                >Advance</button>
                <button
                  type="button"
                  class="px-3 py-1 text-sm font-semibold border-l border-neutral-300 transition-colors"
                  :class="outcomes[t.teamId] === 'eliminated' ? 'bg-red-600 text-white' : 'text-neutral-600 hover:bg-neutral-100'"
                  @click="outcomes[t.teamId] = outcomes[t.teamId] === 'eliminated' ? '' : 'eliminated'"
                >Eliminate</button>
              </div>
            </div>
          </div>
        </div>
      </BaseCard>

      <p v-else class="text-sm text-neutral-500">No judged stages available.</p>
    </template>
  </DashboardShell>
</template>
