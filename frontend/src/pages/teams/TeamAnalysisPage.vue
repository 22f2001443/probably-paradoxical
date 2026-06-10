<script setup>
import { ref, computed } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { useToast } from 'vue-toastification'
import { useAuthStore } from '../../stores/authStore.js'
import { apiUpload } from '../../services/api.js'
import DashboardShell from '../../components/common/DashboardShell.vue'
import BaseCard from '../../components/common/BaseCard.vue'
import BaseButton from '../../components/common/BaseButton.vue'
import RoundLockedNotice from '../../components/common/RoundLockedNotice.vue'
import { useRoundGate } from '../../composables/useRoundGate.js'
import { ROUND_KEYS, formatSubmittedAt } from '../../services/rounds.js'

const auth = useAuthStore()
const router = useRouter()
const toast = useToast()

const { loading: roundLoading, gate: roundGateInfo, locked, submitted, submission } = useRoundGate(ROUND_KEYS.stage3)
const submittedAt = computed(() => formatSubmittedAt(submission.value?.submittedAt))

const MAX_ZIP_BYTES = 50 * 1024 * 1024

const consent = ref(false)
const guidelinesRead = ref(false)
const file = ref(null)
const fileInput = ref(null)
const submitting = ref(false)

const canSubmit = computed(() => !!file.value && consent.value && guidelinesRead.value && !submitting.value)

function onFileChange(event) {
  const picked = event.target.files?.[0] || null
  if (!picked) { file.value = null; return }
  const isZip = picked.name.toLowerCase().endsWith('.zip')
  if (!isZip) {
    toast.error('The submission must be a single .zip file.')
    event.target.value = ''
    file.value = null
    return
  }
  if (picked.size > MAX_ZIP_BYTES) {
    toast.error('The ZIP must be 50 MB or smaller.')
    event.target.value = ''
    file.value = null
    return
  }
  file.value = picked
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function reset() {
  consent.value = false
  guidelinesRead.value = false
  file.value = null
  if (fileInput.value) fileInput.value.value = ''
}

async function submit() {
  if (locked.value) {
    toast.error('This round isn’t open for submissions.')
    return
  }
  if (!canSubmit.value) {
    toast.error('Attach your ZIP and sign the originality declaration.')
    return
  }
  submitting.value = true
  try {
    const data = new FormData()
    data.append('consent', String(consent.value))
    data.append('file', file.value)

    await apiUpload('/team/analysis-submission', data, { token: auth.token })
    toast.success('Analysis submitted.')
    reset()
    router.push('/participant')
  } catch (e) {
    if (e?.status === 401) { auth.logout(); router.push('/login'); return }
    toast.error(e?.message || 'Could not submit.')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <DashboardShell eyebrow="Participant" title="Analysis deliverables">
    <RouterLink to="/participant" class="inline-flex items-center text-sm text-neutral-500 hover:text-neutral-950 mb-6">
      ← Back to dashboard
    </RouterLink>

    <BaseCard v-if="roundLoading" class="max-w-3xl">
      <p class="text-sm text-neutral-500 py-6 text-center">Checking round status…</p>
    </BaseCard>
    <BaseCard v-else-if="locked" class="max-w-3xl">
      <RoundLockedNotice :gate="roundGateInfo" />
    </BaseCard>
    <BaseCard v-else class="max-w-3xl">
      <form class="space-y-6" novalidate @submit.prevent="submit">
        <p
          v-if="submitted"
          class="border border-emerald-200 bg-emerald-50 text-emerald-800 text-sm px-4 py-3"
        >
          ✓ You’ve already submitted this stage<span v-if="submittedAt"> on {{ submittedAt }}</span>.
          Submitting again will replace your previous upload.
        </p>
        <!-- What the ZIP must contain -->
        <div class="border border-neutral-200 bg-neutral-50 p-4">
          <p class="text-xs font-semibold uppercase tracking-widest text-neutral-600 mb-2">Your ZIP must contain</p>
          <ul class="list-disc pl-5 text-sm text-neutral-600 space-y-1">
            <li>The cleaned dataset</li>
            <li>Analysis artifacts (e.g. your <code>.ipynb</code> notebook)</li>
            <li>A document stating your findings</li>
          </ul>
        </div>

        <!-- ZIP file -->
        <div>
          <label for="an-file" class="block text-xs font-semibold uppercase tracking-widest text-neutral-600 mb-2">
            Analysis ZIP <span class="text-red-500">*</span>
          </label>
          <input
            id="an-file"
            ref="fileInput"
            type="file"
            accept=".zip,application/zip,application/x-zip-compressed"
            class="block w-full text-sm text-neutral-600 file:mr-4 file:border-0 file:bg-neutral-950 file:px-4 file:py-2.5 file:text-sm file:font-semibold file:text-white hover:file:bg-neutral-800 file:cursor-pointer cursor-pointer border border-neutral-300 p-2"
            @change="onFileChange"
          />
          <p v-if="file" class="mt-2 text-sm text-neutral-600">
            Selected: <span class="font-semibold text-neutral-950">{{ file.name }}</span> ({{ formatSize(file.size) }})
          </p>
          <p class="mt-1 text-xs text-neutral-400">A single .zip, up to 50 MB.</p>
        </div>

        <!-- Originality declaration -->
        <label class="flex items-start gap-3 cursor-pointer">
          <input v-model="consent" type="checkbox" class="mt-1 h-4 w-4 accent-violet-600" />
          <span class="text-sm text-neutral-700">
            I declare that this analysis is entirely my team's original work and that
            <span class="font-semibold">no LLM or AI assistance was used at this stage</span>.
            I consent to it being reviewed by the organisers and judges.
          </span>
        </label>

        <!-- Guidelines acknowledgement -->
        <label class="flex items-start gap-3 cursor-pointer">
          <input v-model="guidelinesRead" type="checkbox" class="mt-1 h-4 w-4 accent-violet-600" />
          <span class="text-sm text-neutral-700">
            I have read the
            <RouterLink to="/guidelines" target="_blank" class="font-semibold text-violet-700 hover:underline">guidelines document</RouterLink>.
          </span>
        </label>

        <!-- Actions -->
        <div class="flex gap-3 pt-1">
          <BaseButton variant="primary" :disabled="!canSubmit">
            {{ submitting ? 'Submitting…' : 'Submit' }}
          </BaseButton>
          <BaseButton type="button" variant="ghost" :disabled="submitting" @click="reset">Reset</BaseButton>
        </div>
      </form>
    </BaseCard>
  </DashboardShell>
</template>
