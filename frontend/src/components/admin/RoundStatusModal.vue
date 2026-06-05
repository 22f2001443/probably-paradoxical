<script setup>
import { ref, computed } from 'vue'
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/vue'
import { useToast } from 'vue-toastification'
import { useAuthStore } from '../../stores/authStore.js'
import { apiPost } from '../../services/api.js'
import BaseButton from '../common/BaseButton.vue'

const props = defineProps({
  open: { type: Boolean, default: false },
  rounds: { type: Array, default: () => [] },
  currentRoundKey: { type: String, default: null },
  schedules: { type: Array, default: () => [] },
})
const emit = defineEmits(['close', 'updated'])

const toast = useToast()
const auth = useAuthStore()
const savingKey = ref(null)

const STATES = [
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'open', label: 'Open' },
  { value: 'closed', label: 'Closed' },
  { value: 'results_published', label: 'Results published' },
  { value: 'stale', label: 'Stale' },
]

// Schedule form
const scheduleRoundKey = ref('')
const scheduleAt = ref('')
const scheduling = ref(false)
const minDateTime = computed(() => {
  const d = new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
  return d.toISOString().slice(0, 16)
})

function titleFor(key) {
  return props.rounds.find((r) => r.roundKey === key)?.title || key
}

async function post(path, payload, successMsg) {
  try {
    await apiPost(path, payload, { token: auth.token })
    toast.success(successMsg)
    emit('updated')
    return true
  } catch (e) {
    toast.error(e?.message || 'Action failed.')
    return false
  }
}

async function onStateChange(round, event) {
  const state = event.target.value
  if (state === round.state) return
  savingKey.value = round.roundKey
  await post('/admin/rounds', { roundKey: round.roundKey, state }, `${round.title}: ${STATES.find((s) => s.value === state)?.label}`)
  savingKey.value = null
}

async function makeCurrent(round) {
  if (round.roundKey === props.currentRoundKey) return
  savingKey.value = round.roundKey
  await post('/admin/rounds', { roundKey: round.roundKey, makeCurrent: true }, `Current stage → ${round.title} (others cascaded)`)
  savingKey.value = null
}

async function schedule() {
  if (!scheduleRoundKey.value || !scheduleAt.value) {
    toast.error('Pick a stage and a date/time.')
    return
  }
  const runAt = new Date(scheduleAt.value)
  if (Number.isNaN(runAt.getTime()) || runAt.getTime() <= Date.now()) {
    toast.error('Choose a future date/time.')
    return
  }
  scheduling.value = true
  const ok = await post(
    '/admin/rounds',
    { roundKey: scheduleRoundKey.value, makeCurrent: true, runAt: runAt.toISOString() },
    `Scheduled → ${titleFor(scheduleRoundKey.value)}`,
  )
  scheduling.value = false
  if (ok) { scheduleRoundKey.value = ''; scheduleAt.value = '' }
}

async function cancelSchedule(id) {
  await post('/admin/rounds/cancel', { scheduleId: id }, 'Schedule cancelled.')
}
</script>

<template>
  <Dialog :open="open" class="relative z-[60]" @close="emit('close')">
    <div class="fixed inset-0 bg-black/40" aria-hidden="true" />
    <div class="fixed inset-0 flex items-center justify-center p-4 overflow-y-auto">
      <DialogPanel class="w-full max-w-2xl bg-white border border-neutral-200 p-6 md:p-8 shadow-xl my-8">
        <DialogTitle class="text-lg font-bold text-neutral-950 mb-1">Manage stages</DialogTitle>
        <p class="text-sm text-neutral-500 mb-5">
          Setting a stage current cascades the rest: earlier stages become <strong>stale</strong>, the
          new one <strong>open</strong>, later ones <strong>upcoming</strong>.
        </p>

        <div class="divide-y divide-neutral-100">
          <div v-for="round in rounds" :key="round.roundKey" class="py-3 flex flex-wrap items-center gap-3">
            <div class="flex-1 min-w-[10rem] flex items-center gap-2">
              <span class="text-sm font-semibold text-neutral-950">{{ round.title }}</span>
              <span v-if="round.roundKey === currentRoundKey" class="text-[10px] font-bold uppercase tracking-wider bg-violet-600 text-white px-1.5 py-0.5">Current</span>
            </div>
            <select
              :value="round.state"
              :disabled="savingKey === round.roundKey"
              class="border border-neutral-300 px-3 py-2 text-sm min-h-11 focus:outline-none focus:ring-2 focus:ring-violet-600 disabled:opacity-50"
              @change="onStateChange(round, $event)"
            >
              <option v-for="s in STATES" :key="s.value" :value="s.value">{{ s.label }}</option>
            </select>
            <button
              v-if="round.roundKey !== currentRoundKey"
              type="button"
              class="text-sm font-semibold text-violet-700 hover:text-violet-900 disabled:opacity-50 min-h-11 px-2"
              :disabled="savingKey === round.roundKey"
              @click="makeCurrent(round)"
            >
              Set current
            </button>
            <span v-else class="text-sm text-neutral-300 px-2 w-[84px] text-center">current</span>
          </div>
        </div>

        <!-- Schedule a transition -->
        <div class="mt-6 pt-5 border-t border-neutral-200">
          <h3 class="text-sm font-bold text-neutral-950 mb-3">Schedule a transition</h3>
          <div class="flex flex-wrap items-end gap-3">
            <label class="flex-1 min-w-[8rem]">
              <span class="block text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-1">Stage</span>
              <select v-model="scheduleRoundKey" class="w-full border border-neutral-300 px-3 py-2 text-sm min-h-11 focus:outline-none focus:ring-2 focus:ring-violet-600">
                <option value="" disabled>Select…</option>
                <option v-for="r in rounds" :key="r.roundKey" :value="r.roundKey">{{ r.title }}</option>
              </select>
            </label>
            <label class="flex-1 min-w-[10rem]">
              <span class="block text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-1">Run at</span>
              <input v-model="scheduleAt" type="datetime-local" :min="minDateTime" class="w-full border border-neutral-300 px-3 py-2 text-sm min-h-11 focus:outline-none focus:ring-2 focus:ring-violet-600" />
            </label>
            <BaseButton variant="primary" :disabled="scheduling" @click="schedule">{{ scheduling ? 'Scheduling…' : 'Schedule' }}</BaseButton>
          </div>

          <div v-if="schedules.length" class="mt-4">
            <p class="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-2">Pending</p>
            <ul class="divide-y divide-neutral-100">
              <li v-for="s in schedules" :key="s.id" class="flex items-center justify-between gap-3 py-2 text-sm">
                <span class="text-neutral-700">→ <span class="font-medium">{{ titleFor(s.roundKey) }}</span> at {{ new Date(s.runAt).toLocaleString() }}</span>
                <button type="button" class="text-xs font-semibold text-red-600 hover:text-red-800" @click="cancelSchedule(s.id)">Cancel</button>
              </li>
            </ul>
          </div>
        </div>

        <div class="mt-6 flex justify-end">
          <BaseButton variant="outline" @click="emit('close')">Done</BaseButton>
        </div>
      </DialogPanel>
    </div>
  </Dialog>
</template>
