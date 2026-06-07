<script setup>
import { ref, computed, onMounted } from 'vue'
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

const judges = ref([])
const submissions = ref([])
const loading = ref(true)
const error = ref('')
const busy = ref(false)

const judgesPerTeam = ref(1)
const resetExisting = ref(true)

const judgeName = computed(() => new Map(judges.value.map((j) => [j.id, j.name])))
const hasJudges = computed(() => judges.value.length > 0)

async function load() {
  try {
    const data = await apiGet('/admin/assignments', { token: auth.token })
    judges.value = data.judges || []
    submissions.value = data.submissions || []
    error.value = ''
  } catch (e) {
    if (e?.status === 401) { auth.logout(); router.push('/login'); return }
    error.value = e?.message || 'Failed to load assignments.'
  } finally {
    loading.value = false
  }
}

async function autoAssign() {
  if (!hasJudges.value) { toast.error('Add judges first.'); return }
  busy.value = true
  try {
    const res = await apiPost(
      '/admin/assignments/auto',
      { judgesPerTeam: Number(judgesPerTeam.value), reset: resetExisting.value },
      { token: auth.token },
    )
    toast.success(`Assigned ${res.created} judge slot(s) randomly.`)
    await load()
  } catch (e) {
    toast.error(e?.message || 'Auto-assign failed.')
  } finally {
    busy.value = false
  }
}

async function addJudge(sub, judgeId) {
  if (!judgeId) return
  busy.value = true
  try {
    await apiPost('/admin/assignments', { teamId: sub.teamId, judgeId }, { token: auth.token })
    await load()
  } catch (e) {
    toast.error(e?.message || 'Could not assign judge.')
  } finally {
    busy.value = false
  }
}

async function removeJudge(sub, judgeId) {
  busy.value = true
  try {
    await apiPost('/admin/assignments/delete', { teamId: sub.teamId, judgeId }, { token: auth.token })
    await load()
  } catch (e) {
    toast.error(e?.message || 'Could not remove judge.')
  } finally {
    busy.value = false
  }
}

// Judges not yet assigned to a given submission (for the add dropdown).
function availableJudges(sub) {
  return judges.value.filter((j) => !sub.judgeIds.includes(j.id))
}

onMounted(load)
</script>

<template>
  <DashboardShell eyebrow="Organiser" title="Judge assignments">
    <RouterLink to="/admin" class="inline-flex items-center text-sm text-neutral-500 hover:text-neutral-950 mb-6">
      ← Back to dashboard
    </RouterLink>

    <p v-if="loading" class="text-sm text-neutral-500">Loading…</p>
    <p v-else-if="error" class="text-sm text-red-600">{{ error }}</p>

    <template v-else>
      <!-- Judges + auto-assign -->
      <BaseCard class="mb-6">
        <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 class="text-lg font-bold text-neutral-950">Judges <span class="text-neutral-400 font-normal">({{ judges.length }})</span></h2>
        </div>
        <p v-if="!hasJudges" class="text-sm text-neutral-500">
          No active judges yet. Create judges (e.g. via the <code>create-judge</code> script) before assigning.
        </p>
        <ul v-else class="flex flex-wrap gap-2 mb-5">
          <li v-for="j in judges" :key="j.id" class="flex items-center gap-2 border border-neutral-200 px-3 py-1.5 text-sm">
            <span class="font-semibold text-neutral-950">{{ j.name }}</span>
            <span class="text-xs font-semibold text-violet-700 bg-violet-50 px-1.5 py-0.5">{{ j.assignedCount }}</span>
          </li>
        </ul>

        <div class="flex flex-wrap items-end gap-4 border-t border-neutral-100 pt-4">
          <div>
            <label for="jpt" class="block text-xs font-semibold uppercase tracking-widest text-neutral-600 mb-2">Judges per team</label>
            <input
              id="jpt"
              v-model.number="judgesPerTeam"
              type="number"
              min="1"
              :max="judges.length || 1"
              class="w-24 border border-neutral-300 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-violet-600"
            />
          </div>
          <label class="flex items-center gap-2 text-sm text-neutral-700 pb-2.5 cursor-pointer">
            <input v-model="resetExisting" type="checkbox" class="h-4 w-4 accent-violet-600" />
            Reset existing assignments first
          </label>
          <BaseButton variant="primary" :disabled="busy || !hasJudges || !submissions.length" @click="autoAssign">
            {{ busy ? 'Assigning…' : 'Assign randomly' }}
          </BaseButton>
        </div>
      </BaseCard>

      <!-- Submissions table -->
      <h2 class="text-lg font-bold text-neutral-950 mb-3">
        Questionnaire submissions <span class="text-neutral-400 font-normal">({{ submissions.length }})</span>
      </h2>

      <p v-if="!submissions.length" class="text-sm text-neutral-500">
        No teams have submitted a Stage 1 questionnaire yet.
      </p>

      <div v-else class="space-y-3">
        <BaseCard v-for="sub in submissions" :key="sub.submissionId">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <span class="text-xs font-bold text-neutral-400">{{ sub.teamId }}</span>
                <h3 class="font-bold text-neutral-950">{{ sub.teamName }}</h3>
                <span v-if="sub.paradoxCode" class="text-xs font-bold text-violet-700">{{ sub.paradoxCode }}</span>
              </div>
              <p v-if="sub.theme" class="text-sm text-neutral-500 mt-0.5 line-clamp-2">{{ sub.theme }}</p>
            </div>
            <span
              class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 shrink-0"
              :class="sub.judgeIds.length ? 'bg-emerald-600 text-white' : 'border border-neutral-300 text-neutral-500'"
            >
              {{ sub.judgeIds.length }} judge{{ sub.judgeIds.length === 1 ? '' : 's' }}
            </span>
          </div>

          <!-- Assigned judges -->
          <div class="mt-3 flex flex-wrap items-center gap-2">
            <span
              v-for="jid in sub.judgeIds"
              :key="jid"
              class="inline-flex items-center gap-1.5 bg-neutral-100 text-neutral-800 text-sm px-2.5 py-1"
            >
              {{ judgeName.get(jid) || 'Judge' }}
              <button
                type="button"
                class="text-neutral-400 hover:text-red-600"
                :disabled="busy"
                aria-label="Remove judge"
                @click="removeJudge(sub, jid)"
              >&times;</button>
            </span>

            <!-- Add a judge (strategic) -->
            <select
              v-if="availableJudges(sub).length"
              class="border border-neutral-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-violet-600"
              :disabled="busy"
              @change="addJudge(sub, $event.target.value); $event.target.value = ''"
            >
              <option value="">+ Add judge…</option>
              <option v-for="j in availableJudges(sub)" :key="j.id" :value="j.id">{{ j.name }}</option>
            </select>
          </div>
        </BaseCard>
      </div>
    </template>
  </DashboardShell>
</template>
