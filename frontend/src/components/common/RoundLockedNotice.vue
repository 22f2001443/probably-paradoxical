<script setup>
import { RouterLink } from 'vue-router'
import StatusBadge from './StatusBadge.vue'

defineProps({
  /** A gate object from services/rounds.js roundGate(). */
  gate: { type: Object, required: true },
})
</script>

<template>
  <div class="text-center py-6">
    <StatusBadge :status="gate.status" tone="violet" />
    <h2 class="mt-4 text-lg font-bold text-neutral-950">This round isn’t open</h2>
    <p class="mt-2 text-sm text-neutral-600 max-w-md mx-auto">{{ gate.note }}</p>
    <RouterLink
      to="/participant"
      class="mt-6 inline-flex items-center text-sm font-semibold text-violet-700 hover:underline"
    >
      ← Back to dashboard
    </RouterLink>
  </div>
</template>
