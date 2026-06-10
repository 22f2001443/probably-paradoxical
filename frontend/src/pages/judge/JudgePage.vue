<script setup>
import { ref, computed, reactive, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { useToast } from 'vue-toastification'
import { useAuthStore } from '../../stores/authStore.js'
import { apiGet, apiPost, apiGetBlob } from '../../services/api.js'
import DashboardShell from '../../components/common/DashboardShell.vue'
import BaseCard from '../../components/common/BaseCard.vue'
import BaseButton from '../../components/common/BaseButton.vue'

const auth = useAuthStore()
const router = useRouter()
const toast = useToast()

const user = computed(() => auth.user ?? {})
const rubric = ref(null)
const queue = ref([])
const loading = ref(true)
const error = ref('')
const busy = ref(false)
const openId = ref('')           // questionnaireId whose form is expanded
const drafts = reactive({})      // questionnaireId -> { criterionKey: score }
const pdfUrls = reactive({})     // questionnaireId -> object URL of the fetched PDF
const pdfLoading = reactive({})  // questionnaireId -> bool
const pdfError = reactive({})    // questionnaireId -> string

const rubricTotal = computed(() => rubric.value?.total ?? 0)
const stats = computed(() => {
  const scored = queue.value.filter((q) => q.evaluation?.status === 'submitted').length
  return [
    { label: 'Assigned', value: queue.value.length },
    { label: 'Scored', value: scored },
    { label: 'Pending', value: queue.value.length - scored },
  ]
})

function draftTotal(qid) {
  const d = drafts[qid] || {}
  return (rubric.value?.criteria || []).reduce((s, c) => s + (Number(d[c.key]) || 0), 0)
}

function toggle(item) {
  if (openId.value === item.questionnaireId) { openId.value = ''; return }
  // Seed the draft from an existing evaluation (or blanks).
  const d = {}
  for (const c of rubric.value?.criteria || []) {
    const existing = item.evaluation?.criterionScores?.find((s) => s.criterionKey === c.key)
    d[c.key] = existing ? existing.score : ''
  }
  drafts[item.questionnaireId] = d
  openId.value = item.questionnaireId
  if (item.hasPdf) loadPdf(item)
}

async function loadPdf(item) {
  const qid = item.questionnaireId
  if (pdfUrls[qid] || pdfLoading[qid]) return
  pdfLoading[qid] = true
  pdfError[qid] = ''
  try {
    const blob = await apiGetBlob(`/judge/submission-file?questionnaireId=${encodeURIComponent(qid)}`, { token: auth.token })
    pdfUrls[qid] = URL.createObjectURL(blob)
  } catch (e) {
    if (e?.status === 401) { auth.logout(); router.push('/login'); return }
    pdfError[qid] = e?.message || 'Could not load the PDF.'
  } finally {
    pdfLoading[qid] = false
  }
}

function openPdf(item) {
  const url = pdfUrls[item.questionnaireId]
  if (url) window.open(url, '_blank', 'noopener')
}

async function load() {
  try {
    const data = await apiGet('/judge/queue', { token: auth.token })
    rubric.value = data.rubric
    queue.value = data.queue || []
    error.value = ''
  } catch (e) {
    if (e?.status === 401) { auth.logout(); router.push('/login'); return }
    error.value = e?.message || 'Failed to load your queue.'
  } finally {
    loading.value = false
  }
}

async function submit(item, status) {
  const d = drafts[item.questionnaireId] || {}
  for (const c of rubric.value?.criteria || []) {
    const v = Number(d[c.key])
    if (!Number.isFinite(v) || v < 0 || v > c.maxScore) {
      toast.error(`Enter 0–${c.maxScore} for "${c.label}".`)
      return
    }
  }
  const criterionScores = (rubric.value?.criteria || []).map((c) => ({ criterionKey: c.key, score: Number(d[c.key]) }))
  busy.value = true
  try {
    await apiPost('/judge/evaluations', { questionnaireId: item.questionnaireId, criterionScores, status }, { token: auth.token })
    toast.success(status === 'submitted' ? 'Score submitted.' : 'Draft saved.')
    openId.value = ''
    await load()
  } catch (e) {
    toast.error(e?.message || 'Could not save score.')
  } finally {
    busy.value = false
  }
}

onMounted(load)
onBeforeUnmount(() => {
  for (const url of Object.values(pdfUrls)) {
    if (url) URL.revokeObjectURL(url)
  }
})
</script>

<template>
  <DashboardShell eyebrow="Judge" :title="`Judge · ${user.name || 'Reviewer'}`">
    <div class="grid grid-cols-3 gap-4 mb-8">
      <BaseCard v-for="stat in stats" :key="stat.label" class="text-center">
        <p class="text-3xl font-bold text-neutral-950 leading-none">{{ stat.value }}</p>
        <p class="mt-1 text-xs font-semibold uppercase tracking-widest text-neutral-500">{{ stat.label }}</p>
      </BaseCard>
    </div>

    <h2 class="text-lg font-bold text-neutral-950 mb-3">Your review queue</h2>

    <p v-if="loading" class="text-sm text-neutral-500">Loading…</p>
    <p v-else-if="error" class="text-sm text-red-600">{{ error }}</p>
    <BaseCard v-else-if="!queue.length">
      <div class="py-10 text-center">
        <p class="text-sm font-medium text-neutral-700">No questionnaires assigned yet</p>
        <p class="text-sm text-neutral-500 mt-1">
          Questionnaires appear here once the organisers assign them for Stage 1 review.
        </p>
      </div>
    </BaseCard>

    <div v-else class="space-y-3">
      <BaseCard v-for="item in queue" :key="item.questionnaireId">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <span class="text-xs font-bold text-neutral-400">{{ item.teamId }}</span>
              <h3 class="font-bold text-neutral-950">{{ item.teamName }}</h3>
              <span v-if="item.paradoxCode" class="text-xs font-bold text-violet-700">{{ item.paradoxCode }}</span>
            </div>
            <p v-if="item.theme" class="text-sm text-neutral-500 mt-0.5 line-clamp-2">{{ item.theme }}</p>
          </div>
          <div class="flex items-center gap-3 shrink-0">
            <span
              v-if="item.evaluation?.status === 'submitted'"
              class="text-sm font-bold text-emerald-700"
            >{{ item.evaluation.rawTotal }}/{{ rubricTotal }}</span>
            <span
              class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5"
              :class="item.evaluation?.status === 'submitted' ? 'bg-emerald-600 text-white' : 'border border-neutral-300 text-neutral-500'"
            >{{ item.evaluation?.status === 'submitted' ? 'Scored' : (item.evaluation?.status === 'draft' ? 'Draft' : 'Pending') }}</span>
            <BaseButton variant="outline" @click="toggle(item)">
              {{ openId === item.questionnaireId ? 'Close' : (item.evaluation ? 'Edit' : 'Score') }}
            </BaseButton>
          </div>
        </div>

        <!-- Submission details + questionnaire PDF (full, not a preview) -->
        <div v-if="openId === item.questionnaireId" class="mt-4 border-t border-neutral-100 pt-4 space-y-4">
          <dl class="space-y-3">
            <div v-if="item.paradoxCode">
              <dt class="text-xs font-semibold uppercase tracking-widest text-neutral-500">Paradox</dt>
              <dd class="text-sm text-neutral-800 mt-0.5">{{ item.paradoxCode }}</dd>
            </div>
            <div v-if="item.theme">
              <dt class="text-xs font-semibold uppercase tracking-widest text-neutral-500">Theme</dt>
              <dd class="text-sm text-neutral-800 mt-0.5 whitespace-pre-wrap">{{ item.theme }}</dd>
            </div>
            <div v-if="item.rationale">
              <dt class="text-xs font-semibold uppercase tracking-widest text-neutral-500">Rationale</dt>
              <dd class="text-sm text-neutral-800 mt-0.5 whitespace-pre-wrap">{{ item.rationale }}</dd>
            </div>
            <div v-if="item.targetPopulation">
              <dt class="text-xs font-semibold uppercase tracking-widest text-neutral-500">Target population</dt>
              <dd class="text-sm text-neutral-800 mt-0.5">{{ item.targetPopulation }}</dd>
            </div>
          </dl>

          <div v-if="item.hasPdf">
            <div class="flex items-center justify-between mb-2">
              <span class="text-xs font-semibold uppercase tracking-widest text-neutral-500">Questionnaire PDF</span>
              <BaseButton v-if="pdfUrls[item.questionnaireId]" variant="ghost" @click="openPdf(item)">
                Open in new tab ↗
              </BaseButton>
            </div>
            <p v-if="pdfError[item.questionnaireId]" class="text-sm text-red-600">{{ pdfError[item.questionnaireId] }}</p>
            <p v-else-if="pdfLoading[item.questionnaireId]" class="text-sm text-neutral-500">Loading PDF…</p>
            <iframe
              v-else-if="pdfUrls[item.questionnaireId]"
              :src="pdfUrls[item.questionnaireId]"
              class="w-full h-[70vh] border border-neutral-200"
              title="Questionnaire PDF"
            />
            <BaseButton v-else variant="outline" @click="loadPdf(item)">View PDF</BaseButton>
          </div>
          <p v-else class="text-sm text-neutral-400">No questionnaire PDF attached.</p>
        </div>

        <!-- Scoring form -->
        <div v-if="openId === item.questionnaireId && rubric" class="mt-4 border-t border-neutral-100 pt-4 space-y-3">
          <div
            v-for="c in rubric.criteria"
            :key="c.key"
            class="flex items-center justify-between gap-3"
          >
            <label :for="`${item.questionnaireId}-${c.key}`" class="text-sm text-neutral-700">
              {{ c.label }} <span class="text-neutral-400">(max {{ c.maxScore }})</span>
            </label>
            <input
              :id="`${item.questionnaireId}-${c.key}`"
              v-model="drafts[item.questionnaireId][c.key]"
              type="number"
              min="0"
              :max="c.maxScore"
              step="any"
              class="w-24 border border-neutral-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-violet-600"
            />
          </div>
          <div class="flex items-center justify-between pt-2 border-t border-neutral-100">
            <span class="text-sm font-bold text-neutral-950">Total: {{ draftTotal(item.questionnaireId) }}/{{ rubricTotal }}</span>
            <div class="flex gap-2">
              <BaseButton variant="ghost" :disabled="busy" @click="submit(item, 'draft')">Save draft</BaseButton>
              <BaseButton variant="primary" :disabled="busy" @click="submit(item, 'submitted')">
                {{ busy ? 'Saving…' : 'Submit score' }}
              </BaseButton>
            </div>
          </div>
        </div>
      </BaseCard>
    </div>
  </DashboardShell>
</template>
