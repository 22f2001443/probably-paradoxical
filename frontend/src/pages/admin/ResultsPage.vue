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

// Auto-advance rule: top X% of scored teams, or every team scoring >= a threshold.
const ruleMode = ref('percent') // 'percent' | 'threshold'
const ruleValue = ref('')

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
  // Judges' computed scores are the default for judge-scored stages…
  const judgeScores = computedScores.value[selectedRound.value] || {}
  for (const [teamId, v] of Object.entries(judgeScores)) sc[teamId] = v.score
  // …but a saved/published result wins, so a manual entry or an admin override
  // of the judge average survives reloads.
  for (const r of resultsForRound(selectedRound.value)) {
    map[r.teamId] = r.outcome
    if (r.aggregateScore != null) sc[r.teamId] = r.aggregateScore
  }
  outcomes.value = map
  scores.value = sc
}

watch(selectedRound, syncRound)

function setAll(outcome) {
  const map = { ...outcomes.value }
  for (const t of teams.value) map[t.teamId] = outcome
  outcomes.value = map
}

// Effective score for a team in the selected round: the value in the score box
// (a manual entry, or an admin's override of the judge average). A blank box
// falls back to the judges' computed average where one exists.
function scoreFor(teamId) {
  const s = scores.value[teamId]
  if (s !== '' && s != null && Number.isFinite(Number(s))) return Number(s)
  const c = computedForRound.value[teamId]
  return c ? c.score : null
}

// Apply the auto-advance rule to teams that have a valid score. Teams without a
// score are left undecided. Only sets the local advance/eliminate marks — the
// admin reviews and then publishes.
function applyRule() {
  const v = Number(ruleValue.value)
  if (ruleValue.value === '' || !Number.isFinite(v)) { toast.error('Enter a number for the rule first.'); return }

  const scored = teams.value
    .map((t) => ({ teamId: t.teamId, score: scoreFor(t.teamId) }))
    .filter((x) => x.score != null)
  if (!scored.length) { toast.error('No scored teams to apply the rule to.'); return }

  const map = { ...outcomes.value }
  if (ruleMode.value === 'percent') {
    if (v <= 0 || v > 100) { toast.error('Percentage must be between 1 and 100.'); return }
    const sorted = [...scored].sort((a, b) => b.score - a.score)
    const n = Math.max(1, Math.ceil((sorted.length * v) / 100))
    const cutoff = sorted[n - 1].score // advance everyone at/above the cutoff (ties included)
    for (const x of scored) map[x.teamId] = x.score >= cutoff ? 'advanced' : 'eliminated'
  } else {
    for (const x of scored) map[x.teamId] = x.score >= v ? 'advanced' : 'eliminated'
  }
  outcomes.value = map
  const adv = scored.filter((x) => map[x.teamId] === 'advanced').length
  toast.success(`${adv} of ${scored.length} scored team(s) marked to advance. Review, then Publish.`)
}

// Persist scores without publishing. Judge-scored stages save the judges'
// computed scores; manual stages save the typed values. Teams don't see these
// until results are published.
async function saveScores() {
  const payload = teams.value
    .map((t) => ({ teamId: t.teamId, aggregateScore: scoreFor(t.teamId) }))
    .filter((x) => x.aggregateScore != null)
  if (!payload.length) { toast.error('There are no scores to save yet.'); return }

  busy.value = true
  try {
    const res = await apiPost('/admin/results/scores', { roundKey: selectedRound.value, scores: payload }, { token: auth.token })
    // Preserve in-progress advance/eliminate marks across the refresh.
    const keep = { ...outcomes.value }
    await load()
    const map = { ...outcomes.value }
    for (const t of teams.value) {
      if (keep[t.teamId] === 'advanced' || keep[t.teamId] === 'eliminated') map[t.teamId] = keep[t.teamId]
    }
    outcomes.value = map
    toast.success(`Saved ${res.saved} score(s).`)
  } catch (e) {
    toast.error(e?.message || 'Could not save scores.')
  } finally {
    busy.value = false
  }
}

// Persist a single team's score without publishing. Unlike saveScores(), this
// writes only the one team, so an admin can record/override scores team by team.
// Patches the local results cache instead of a full reload, so other teams'
// unsaved score edits aren't clobbered.
async function saveOneScore(teamId) {
  const score = scoreFor(teamId)
  if (score == null) { toast.error('Enter a score for this team first.'); return }

  busy.value = true
  try {
    await apiPost(
      '/admin/results/scores',
      { roundKey: selectedRound.value, scores: [{ teamId, aggregateScore: score }] },
      { token: auth.token },
    )
    const existing = results.value.find((r) => r.roundKey === selectedRound.value && r.teamId === teamId)
    if (existing) existing.aggregateScore = score
    else results.value.push({ roundKey: selectedRound.value, teamId, outcome: 'pending', aggregateScore: score })
    scores.value[teamId] = score
    toast.success(`Saved score for ${teamId}.`)
  } catch (e) {
    toast.error(e?.message || 'Could not save score.')
  } finally {
    busy.value = false
  }
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
      const s = scoreFor(t.teamId)
      if (s != null) entry.aggregateScore = s
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
            <BaseButton variant="ghost" :disabled="busy" @click="saveScores">
              {{ busy ? 'Saving…' : 'Save scores' }}
            </BaseButton>
            <BaseButton variant="primary" :disabled="busy || counts.set === 0" @click="publish">
              {{ busy ? 'Publishing…' : 'Publish results' }}
            </BaseButton>
          </div>
        </div>

        <!-- Auto-advance rule: mark the top X% (ties included) or everyone at/above
             a score threshold. Acts only on teams that have a score. -->
        <div class="flex flex-wrap items-center gap-2 mb-4 p-3 bg-neutral-50 border border-neutral-200">
          <span class="text-xs font-semibold uppercase tracking-wider text-neutral-500">Auto-advance</span>
          <div class="inline-flex border border-neutral-300">
            <button
              type="button"
              class="px-3 py-1 text-sm font-semibold transition-colors"
              :class="ruleMode === 'percent' ? 'bg-neutral-950 text-white' : 'text-neutral-600 hover:bg-neutral-100'"
              @click="ruleMode = 'percent'"
            >Top %</button>
            <button
              type="button"
              class="px-3 py-1 text-sm font-semibold border-l border-neutral-300 transition-colors"
              :class="ruleMode === 'threshold' ? 'bg-neutral-950 text-white' : 'text-neutral-600 hover:bg-neutral-100'"
              @click="ruleMode = 'threshold'"
            >Score ≥</button>
          </div>
          <input
            v-model="ruleValue"
            type="number"
            step="any"
            :placeholder="ruleMode === 'percent' ? 'e.g. 50' : 'e.g. 70'"
            class="w-24 border border-neutral-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-violet-600"
          />
          <span class="text-sm text-neutral-500">
            {{ ruleMode === 'percent' ? '% of scored teams advance' : 'and above advance — the rest are eliminated' }}
          </span>
          <BaseButton variant="ghost" :disabled="busy" @click="applyRule">Apply rule</BaseButton>
        </div>

        <p v-if="usesJudgeScores" class="text-xs text-neutral-500 mb-3">
          Scores are pre-filled with the judges' weighted averages out of {{ rubricTotal }} (teams ordered by score).
          Edit a box to override that team; clear it to keep the judge value. Save scores to persist overrides.
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
              <!-- Editable score. On judge-scored stages it is pre-filled with the
                   judges' average; type to override one team, clear to fall back. -->
              <input
                v-model="scores[t.teamId]"
                type="number"
                step="any"
                :placeholder="usesJudgeScores ? 'judge avg' : 'score'"
                class="w-20 border border-neutral-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-violet-600"
              />
              <span v-if="usesJudgeScores" class="text-xs text-neutral-400 w-24 shrink-0">
                <template v-if="computedForRound[t.teamId]">/ {{ rubricTotal }} · {{ computedForRound[t.teamId].judges }} judge(s)</template>
                <template v-else>no judges yet</template>
              </span>
              <!-- Save just this team's score, independent of the bulk Save scores. -->
              <button
                type="button"
                class="px-2 py-1 text-sm font-semibold border border-neutral-300 text-neutral-600 transition-colors hover:bg-neutral-100 disabled:opacity-50"
                :disabled="busy"
                title="Save this team's score"
                @click="saveOneScore(t.teamId)"
              >Save</button>
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
