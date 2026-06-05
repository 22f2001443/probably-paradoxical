<script setup>
import { ref } from 'vue'
import { useToast } from 'vue-toastification'
import { useAuthStore } from '../../stores/authStore.js'
import BaseCard from '../common/BaseCard.vue'
import BaseButton from '../common/BaseButton.vue'

const emit = defineEmits(['done'])
const toast = useToast()
const auth = useAuthStore()

const current = ref('')
const next = ref('')
const confirm = ref('')
const loading = ref(false)

const inputClass =
  'w-full border border-neutral-300 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-violet-600 focus:border-transparent min-h-11 transition-shadow'

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
    current.value = next.value = confirm.value = ''
    emit('done')
  } catch (error) {
    toast.error(error?.message || 'Could not change password.')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <BaseCard class="mb-8 max-w-lg">
    <h2 class="text-lg font-bold text-neutral-950 mb-1">Change password</h2>
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
        <BaseButton variant="ghost" :disabled="loading" @click="emit('done')">Cancel</BaseButton>
      </div>
    </form>
  </BaseCard>
</template>
