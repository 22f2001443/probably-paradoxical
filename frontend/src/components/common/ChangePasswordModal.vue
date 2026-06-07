<script setup>
import { ref, watch } from 'vue'
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/vue'
import { useToast } from 'vue-toastification'
import { useAuthStore } from '../../stores/authStore.js'
import BaseButton from '../common/BaseButton.vue'

const props = defineProps({
  open: { type: Boolean, default: false },
})
const emit = defineEmits(['close'])

const toast = useToast()
const auth = useAuthStore()

const current = ref('')
const next = ref('')
const confirm = ref('')
const loading = ref(false)

const inputClass =
  'w-full border border-neutral-300 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-violet-600 focus:border-transparent min-h-11 transition-shadow'

// Reset fields whenever the modal opens.
watch(() => props.open, (isOpen) => {
  if (isOpen) {
    current.value = next.value = confirm.value = ''
  }
})

function close() {
  if (!loading.value) emit('close')
}

async function submit() {
  if (!current.value || !next.value) {
    toast.error('Enter your current and new password.')
    return
  }
  if (next.value.length < 8) {
    toast.error('New password must be at least 8 characters.')
    return
  }
  if (next.value !== confirm.value) {
    toast.error('New password and confirmation do not match.')
    return
  }
  if (next.value === current.value) {
    toast.error('New password must be different from the current one.')
    return
  }

  loading.value = true
  try {
    await auth.changePassword(current.value, next.value)
    toast.success('Password updated.')
    emit('close')
  } catch (error) {
    toast.error(error?.message || 'Could not change password.')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <Dialog :open="open" class="relative z-[60]" @close="close">
    <div class="fixed inset-0 bg-black/40" aria-hidden="true" />
    <div class="fixed inset-0 flex items-center justify-center p-4">
      <DialogPanel class="w-full max-w-md bg-white border border-neutral-200 p-6 md:p-8 shadow-xl">
        <DialogTitle class="text-lg font-bold text-neutral-950 mb-1">Change password</DialogTitle>
        <p class="text-sm text-neutral-500 mb-5">
          For teams this changes the shared team password used by every member.
        </p>

        <form class="space-y-4" novalidate @submit.prevent="submit">
          <div>
            <label for="cp-current" class="block text-xs font-semibold uppercase tracking-widest text-neutral-600 mb-2">Current password</label>
            <input id="cp-current" v-model="current" type="password" autocomplete="current-password" :class="inputClass" />
          </div>
          <div>
            <label for="cp-new" class="block text-xs font-semibold uppercase tracking-widest text-neutral-600 mb-2">New password</label>
            <input id="cp-new" v-model="next" type="password" autocomplete="new-password" :class="inputClass" />
          </div>
          <div>
            <label for="cp-confirm" class="block text-xs font-semibold uppercase tracking-widest text-neutral-600 mb-2">Confirm new password</label>
            <input id="cp-confirm" v-model="confirm" type="password" autocomplete="new-password" :class="inputClass" />
          </div>
          <div class="flex gap-3 pt-1">
            <BaseButton variant="primary" :disabled="loading">{{ loading ? 'Saving…' : 'Update password' }}</BaseButton>
            <BaseButton variant="ghost" :disabled="loading" @click="close">Cancel</BaseButton>
          </div>
        </form>
      </DialogPanel>
    </div>
  </Dialog>
</template>
