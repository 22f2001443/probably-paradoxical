<script setup>
import { ref } from 'vue'
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/vue'
import { useToast } from 'vue-toastification'
import { useAuthStore } from '../../stores/authStore.js'
import { apiPost } from '../../services/api.js'
import BaseButton from '../common/BaseButton.vue'

const props = defineProps({
  open: { type: Boolean, default: false },
  rounds: { type: Array, default: () => [] },
  currentRoundKey: { type: String, default: null },
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
]

async function update(round, payload, successMsg) {
  savingKey.value = round.roundKey
  try {
    await apiPost('/admin/rounds', { roundKey: round.roundKey, ...payload }, { token: auth.token })
    toast.success(successMsg)
    emit('updated')
  } catch (e) {
    toast.error(e?.message || 'Update failed.')
  } finally {
    savingKey.value = null
  }
}

function onStateChange(round, event) {
  const state = event.target.value
  if (state === round.state) return
  update(round, { state }, `${round.title}: ${STATES.find((s) => s.value === state)?.label}`)
}

function makeCurrent(round) {
  if (round.roundKey === props.currentRoundKey) return
  update(round, { makeCurrent: true }, `Current stage → ${round.title}`)
}
</script>

<template>
  <Dialog :open="open" class="relative z-[60]" @close="emit('close')">
    <div class="fixed inset-0 bg-black/40" aria-hidden="true" />
    <div class="fixed inset-0 flex items-center justify-center p-4">
      <DialogPanel class="w-full max-w-2xl bg-white border border-neutral-200 p-6 md:p-8 shadow-xl">
        <DialogTitle class="text-lg font-bold text-neutral-950 mb-1">Manage stages</DialogTitle>
        <p class="text-sm text-neutral-500 mb-5">
          Set the current stage and change each stage's status. Changes apply immediately.
        </p>

        <div class="divide-y divide-neutral-100">
          <div
            v-for="round in rounds"
            :key="round.roundKey"
            class="py-3 flex flex-wrap items-center gap-3"
          >
            <div class="flex-1 min-w-[10rem] flex items-center gap-2">
              <span class="text-sm font-semibold text-neutral-950">{{ round.title }}</span>
              <span
                v-if="round.roundKey === currentRoundKey"
                class="text-[10px] font-bold uppercase tracking-wider bg-violet-600 text-white px-1.5 py-0.5"
              >
                Current
              </span>
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

        <div class="mt-6 flex justify-end">
          <BaseButton variant="outline" @click="emit('close')">Done</BaseButton>
        </div>
      </DialogPanel>
    </div>
  </Dialog>
</template>
