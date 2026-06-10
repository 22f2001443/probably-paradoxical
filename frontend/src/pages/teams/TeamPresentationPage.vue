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

const { loading: roundLoading, gate: roundGateInfo, locked, submitted, submission } = useRoundGate(ROUND_KEYS.stage4)
const submittedAt = computed(() => formatSubmittedAt(submission.value?.submittedAt))

const MAX_BYTES = 50 * 1024 * 1024
const ALLOWED_EXTENSIONS = ['ppt', 'pptx', 'pdf']

const consent = ref(false)
const guidelinesRead = ref(false)
const file = ref(null)
const fileInput = ref(null)
const submitting = ref(false)

const canSubmit = computed(() => !!file.value && consent.value && guidelinesRead.value && !submitting.value)

function onFileChange(event) {
  const picked = event.target.files?.[0] || null
  if (!picked) { file.value = null; return }
  const ext = (picked.name.split('.').pop() || '').toLowerCase()
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    toast.error('The presentation must be a PPT, PPTX, or PDF.')
    event.target.value = ''
    file.value = null
    return
  }
  if (picked.size > MAX_BYTES) {
    toast.error('The presentation must be 50 MB or smaller.')
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
    toast.error('Attach your presentation and sign the declaration.')
    return
  }
  submitting.value = true
  try {
    const data = new FormData()
    data.append('consent', String(consent.value))
    data.append('file', file.value)

    await apiUpload('/team/presentation-submission', data, { token: auth.token })
    toast.success('Presentation submitted.')
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
  <DashboardShell eyebrow="Participant" title="Final presentation">
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
        <!-- Presentation file -->
        <div>
          <label for="pr-file" class="block text-xs font-semibold uppercase tracking-widest text-neutral-600 mb-2">
            Presentation (PPT / PPTX / PDF) <span class="text-red-500">*</span>
          </label>
          <input
            id="pr-file"
            ref="fileInput"
            type="file"
            accept=".ppt,.pptx,.pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/pdf"
            class="block w-full text-sm text-neutral-600 file:mr-4 file:border-0 file:bg-neutral-950 file:px-4 file:py-2.5 file:text-sm file:font-semibold file:text-white hover:file:bg-neutral-800 file:cursor-pointer cursor-pointer border border-neutral-300 p-2"
            @change="onFileChange"
          />
          <p v-if="file" class="mt-2 text-sm text-neutral-600">
            Selected: <span class="font-semibold text-neutral-950">{{ file.name }}</span> ({{ formatSize(file.size) }})
          </p>
          <p class="mt-1 text-xs text-neutral-400">PPT, PPTX, or PDF — up to 50 MB.</p>
        </div>

        <!-- Declaration -->
        <label class="flex items-start gap-3 cursor-pointer">
          <input v-model="consent" type="checkbox" class="mt-1 h-4 w-4 accent-violet-600" />
          <span class="text-sm text-neutral-700">
            I declare that this presentation is based entirely on the findings my team already
            submitted at the end of the previous stage, with no new or altered results.
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
