<script setup>
import { ref, computed, onMounted } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { useToast } from 'vue-toastification'
import { useAuthStore } from '../../stores/authStore.js'
import { apiGet, apiUpload } from '../../services/api.js'
import DashboardShell from '../../components/common/DashboardShell.vue'
import BaseCard from '../../components/common/BaseCard.vue'
import BaseButton from '../../components/common/BaseButton.vue'

const auth = useAuthStore()
const router = useRouter()
const toast = useToast()

const MAX_PDF_BYTES = 10 * 1024 * 1024

const paradoxes = ref([])
const loadingParadoxes = ref(true)
const paradoxError = ref('')

const form = ref({ paradoxCode: '', theme: '', rationale: '', consent: false })
const file = ref(null)
const fileInput = ref(null)
const submitting = ref(false)

const inputClass =
  'w-full border border-neutral-300 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-violet-600 focus:border-transparent transition-shadow'

const canSubmit = computed(
  () => !!form.value.paradoxCode && !!form.value.theme.trim() && !!file.value && form.value.consent && !submitting.value,
)

async function loadParadoxes() {
  try {
    const res = await apiGet('/paradoxes', { token: auth.token })
    paradoxes.value = res.paradoxes || []
    paradoxError.value = ''
  } catch (e) {
    if (e?.status === 401) { auth.logout(); router.push('/login'); return }
    paradoxError.value = e?.message || 'Failed to load paradoxes.'
  } finally {
    loadingParadoxes.value = false
  }
}

function onFileChange(event) {
  const picked = event.target.files?.[0] || null
  if (!picked) { file.value = null; return }
  const isPdf = picked.type === 'application/pdf' || picked.name.toLowerCase().endsWith('.pdf')
  if (!isPdf) {
    toast.error('The questionnaire must be a PDF.')
    event.target.value = ''
    file.value = null
    return
  }
  if (picked.size > MAX_PDF_BYTES) {
    toast.error('The PDF must be 10 MB or smaller.')
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
  form.value = { paradoxCode: '', theme: '', rationale: '', consent: false }
  file.value = null
  if (fileInput.value) fileInput.value.value = ''
}

async function submit() {
  if (!canSubmit.value) {
    toast.error('Complete all required fields and accept the consent declaration.')
    return
  }
  submitting.value = true
  try {
    const data = new FormData()
    data.append('paradoxCode', form.value.paradoxCode)
    data.append('theme', form.value.theme.trim())
    data.append('rationale', form.value.rationale.trim())
    data.append('consent', String(form.value.consent))
    data.append('file', file.value)

    await apiUpload('/team/theme-submission', data, { token: auth.token })
    toast.success('Theme & questionnaire submitted.')
    reset()
    router.push('/participant')
  } catch (e) {
    if (e?.status === 401) { auth.logout(); router.push('/login'); return }
    toast.error(e?.message || 'Could not submit.')
  } finally {
    submitting.value = false
  }
}

onMounted(loadParadoxes)
</script>

<template>
  <DashboardShell eyebrow="Participant" title="Theme & Questionnaire">
    <RouterLink to="/participant" class="inline-flex items-center text-sm text-neutral-500 hover:text-neutral-950 mb-6">
      ← Back to dashboard
    </RouterLink>

    <BaseCard class="max-w-3xl">
      <form class="space-y-6" novalidate @submit.prevent="submit">
        <!-- Paradox selector -->
        <div>
          <label for="th-paradox" class="block text-xs font-semibold uppercase tracking-widest text-neutral-600 mb-2">
            Paradox <span class="text-red-500">*</span>
          </label>
          <p v-if="paradoxError" class="text-sm text-red-600 mb-2">{{ paradoxError }}</p>
          <select id="th-paradox" v-model="form.paradoxCode" :class="inputClass" :disabled="loadingParadoxes">
            <option value="" disabled>
              {{ loadingParadoxes ? 'Loading paradoxes…' : 'Select a paradox' }}
            </option>
            <option v-for="p in paradoxes" :key="p.id" :value="p.paradoxCode">
              {{ p.paradoxCode }} — {{ p.name }}
            </option>
          </select>
        </div>

        <!-- Theme -->
        <div>
          <label for="th-theme" class="block text-xs font-semibold uppercase tracking-widest text-neutral-600 mb-2">
            Theme <span class="text-red-500">*</span>
          </label>
          <textarea
            id="th-theme"
            v-model="form.theme"
            rows="6"
            placeholder="Describe the real-world theme your team will explore for this paradox."
            :class="inputClass"
          />
        </div>

        <!-- Rationale (optional) -->
        <div>
          <label for="th-rationale" class="block text-xs font-semibold uppercase tracking-widest text-neutral-600 mb-2">
            Why this theme? <span class="text-neutral-400 normal-case font-normal">(optional)</span>
          </label>
          <textarea
            id="th-rationale"
            v-model="form.rationale"
            rows="3"
            placeholder="Explain why you chose this theme."
            :class="inputClass"
          />
        </div>

        <!-- Questionnaire PDF -->
        <div>
          <label for="th-file" class="block text-xs font-semibold uppercase tracking-widest text-neutral-600 mb-2">
            Questionnaire (PDF) <span class="text-red-500">*</span>
          </label>
          <input
            id="th-file"
            ref="fileInput"
            type="file"
            accept="application/pdf,.pdf"
            class="block w-full text-sm text-neutral-600 file:mr-4 file:border-0 file:bg-neutral-950 file:px-4 file:py-2.5 file:text-sm file:font-semibold file:text-white hover:file:bg-neutral-800 file:cursor-pointer cursor-pointer border border-neutral-300 p-2"
            @change="onFileChange"
          />
          <p v-if="file" class="mt-2 text-sm text-neutral-600">
            Selected: <span class="font-semibold text-neutral-950">{{ file.name }}</span> ({{ formatSize(file.size) }})
          </p>
          <p class="mt-1 text-xs text-neutral-400">PDF only, up to 10 MB.</p>
        </div>

        <!-- Consent -->
        <label class="flex items-start gap-3 cursor-pointer">
          <input v-model="form.consent" type="checkbox" class="mt-1 h-4 w-4 accent-violet-600" />
          <span class="text-sm text-neutral-700">
            I confirm this submission is my team's own work and consent to it being reviewed by the
            organisers and judges.
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
