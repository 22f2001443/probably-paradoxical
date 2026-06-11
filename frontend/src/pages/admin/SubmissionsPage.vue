<script setup>
import { ref, computed, reactive, onMounted } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { useToast } from 'vue-toastification'
import { useAuthStore } from '../../stores/authStore.js'
import { apiGet, apiGetBlob } from '../../services/api.js'
import DashboardShell from '../../components/common/DashboardShell.vue'
import BaseCard from '../../components/common/BaseCard.vue'
import BaseButton from '../../components/common/BaseButton.vue'

const auth = useAuthStore()
const router = useRouter()
const toast = useToast()

const submissions = ref([])
const rounds = ref([])
const loading = ref(true)
const refreshing = ref(false)
const error = ref('')
const fileBusy = reactive({}) // fileId -> bool

const TYPE_LABEL = {
  theme: 'Theme & Questionnaire',
  dataset: 'Raw dataset',
  analysis_zip: 'Analysis ZIP',
  presentation: 'Presentation',
  none: '—',
}

const total = computed(() => submissions.value.length)

// Group submissions by round, ordered by the round pipeline order.
const grouped = computed(() => {
  const meta = new Map(rounds.value.map((r) => [r.roundKey, r]))
  const groups = new Map()
  for (const s of submissions.value) {
    if (!groups.has(s.roundKey)) groups.set(s.roundKey, [])
    groups.get(s.roundKey).push(s)
  }
  return [...groups.entries()]
    .map(([roundKey, items]) => ({
      roundKey,
      title: meta.get(roundKey)?.title || roundKey,
      orderNum: meta.get(roundKey)?.order ?? 99,
      items,
    }))
    .sort((a, b) => a.orderNum - b.orderNum)
})

function typeLabel(type) {
  return TYPE_LABEL[type] ?? type
}
function formatSize(bytes) {
  if (bytes == null) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
function formatDate(value) {
  if (!value) return '—'
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}
function isPdf(file) {
  return (file.contentType || '').includes('pdf') || (file.name || '').toLowerCase().endsWith('.pdf')
}
function fileActionLabel(file) {
  return isPdf(file) ? 'View' : 'Download'
}

async function load({ initial = false } = {}) {
  if (initial) loading.value = true
  else refreshing.value = true
  try {
    const data = await apiGet('/admin/submissions', { token: auth.token })
    submissions.value = data.submissions || []
    rounds.value = data.rounds || []
    error.value = ''
  } catch (e) {
    if (e?.status === 401) { auth.logout(); router.push('/login'); return }
    error.value = e?.message || 'Failed to load submissions.'
  } finally {
    loading.value = false
    refreshing.value = false
  }
}

// View (PDFs inline in a new tab) or download (other artifacts) — all from the
// portal, fetched with the admin token.
async function openFile(file) {
  if (fileBusy[file.fileId]) return
  fileBusy[file.fileId] = true
  try {
    const blob = await apiGetBlob(`/admin/submission-file?fileId=${encodeURIComponent(file.fileId)}`, { token: auth.token })
    const url = URL.createObjectURL(blob)
    if (isPdf(file)) {
      window.open(url, '_blank', 'noopener')
    } else {
      const a = document.createElement('a')
      a.href = url
      a.download = file.name || `artifact-${file.fileId}`
      document.body.appendChild(a)
      a.click()
      a.remove()
    }
    setTimeout(() => URL.revokeObjectURL(url), 60000)
  } catch (e) {
    if (e?.status === 401) { auth.logout(); router.push('/login'); return }
    toast.error(e?.message || 'Could not open the file.')
  } finally {
    fileBusy[file.fileId] = false
  }
}

onMounted(() => load({ initial: true }))
</script>

<template>
  <DashboardShell eyebrow="Organiser" title="Submissions">
    <RouterLink to="/admin" class="inline-flex items-center text-sm text-neutral-500 hover:text-neutral-950 mb-6">
      ← Back to dashboard
    </RouterLink>

    <div class="flex flex-wrap items-center justify-between gap-3 mb-6">
      <p class="text-sm text-neutral-500">
        <span class="font-bold text-neutral-950">{{ total }}</span> submission{{ total === 1 ? '' : 's' }} across all rounds
      </p>
      <BaseButton variant="ghost" :disabled="refreshing || loading" @click="load()">
        {{ refreshing ? 'Refreshing…' : 'Refresh' }}
      </BaseButton>
    </div>

    <p v-if="loading" class="text-sm text-neutral-500">Loading…</p>
    <p v-else-if="error" class="text-sm text-red-600">{{ error }}</p>
    <BaseCard v-else-if="!total">
      <div class="py-10 text-center">
        <p class="text-sm font-medium text-neutral-700">No submissions yet</p>
        <p class="text-sm text-neutral-500 mt-1">Submitted artifacts will appear here as teams upload them.</p>
      </div>
    </BaseCard>

    <div v-else class="space-y-8">
      <section v-for="group in grouped" :key="group.roundKey">
        <h2 class="text-lg font-bold text-neutral-950 mb-3">
          {{ group.title }} <span class="text-neutral-400 font-normal">({{ group.items.length }})</span>
        </h2>

        <div class="space-y-3">
          <BaseCard v-for="sub in group.items" :key="sub.submissionId">
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div class="min-w-0">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="text-xs font-bold text-neutral-400">{{ sub.teamId }}</span>
                  <h3 class="font-bold text-neutral-950">{{ sub.teamName }}</h3>
                  <span class="text-xs font-semibold text-violet-700 bg-violet-50 px-1.5 py-0.5">{{ typeLabel(sub.type) }}</span>
                  <span v-if="sub.paradoxCode" class="text-xs font-bold text-neutral-500">{{ sub.paradoxCode }}</span>
                </div>
                <p v-if="sub.theme" class="text-sm text-neutral-500 mt-1 line-clamp-2">{{ sub.theme }}</p>
                <p class="text-xs text-neutral-400 mt-1">Submitted {{ formatDate(sub.submittedAt) }}</p>
              </div>
              <span
                class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 shrink-0"
                :class="sub.status === 'submitted' ? 'bg-emerald-600 text-white' : 'border border-neutral-300 text-neutral-500'"
              >{{ sub.status }}</span>
            </div>

            <!-- Artifacts -->
            <div class="mt-3 border-t border-neutral-100 pt-3">
              <div v-if="sub.files.length" class="flex flex-col gap-2">
                <div
                  v-for="file in sub.files"
                  :key="file.fileId"
                  class="flex flex-wrap items-center justify-between gap-2"
                >
                  <div class="min-w-0">
                    <span class="text-sm font-medium text-neutral-800 break-all">{{ file.name }}</span>
                    <span v-if="file.sizeBytes" class="text-xs text-neutral-400 ml-2">{{ formatSize(file.sizeBytes) }}</span>
                  </div>
                  <BaseButton variant="outline" class="shrink-0" :disabled="fileBusy[file.fileId]" @click="openFile(file)">
                    {{ fileBusy[file.fileId] ? 'Opening…' : fileActionLabel(file) }}
                  </BaseButton>
                </div>
              </div>
              <p v-else class="text-sm text-neutral-400">No file attached.</p>
            </div>
          </BaseCard>
        </div>
      </section>
    </div>
  </DashboardShell>
</template>
