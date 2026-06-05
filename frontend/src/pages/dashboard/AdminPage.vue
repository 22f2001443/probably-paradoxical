<script setup>
import { computed } from 'vue'
import { useAuthStore } from '../../stores/authStore.js'
import DashboardShell from '../../components/dashboard/DashboardShell.vue'
import BaseCard from '../../components/common/BaseCard.vue'
import BaseButton from '../../components/common/BaseButton.vue'
import StatCard from '../../components/common/StatCard.vue'

const auth = useAuthStore()
const user = computed(() => auth.user ?? {})

// Placeholder KPIs until the admin overview endpoint lands.
const kpis = [
  { value: '—', label: 'Teams' },
  { value: '—', label: 'Members' },
  { value: '—', label: 'Judges' },
  { value: 'Inauguration', label: 'Current round' },
]

const controls = [
  { title: 'Paradoxes', desc: 'Draft and publish the paradox statements teams choose from.', action: 'Manage' },
  { title: 'Rounds', desc: 'Open and close submission windows across the five stages.', action: 'Manage' },
  { title: 'Judge assignments', desc: 'Assign judges to questionnaires for Stage 1 review.', action: 'Assign' },
  { title: 'Results', desc: 'Aggregate scores and publish advancement per round.', action: 'Publish' },
]
</script>

<template>
  <DashboardShell eyebrow="Organiser" :title="`Admin · ${user.name || user.username || 'Organiser'}`">
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      <StatCard v-for="kpi in kpis" :key="kpi.label" :value="kpi.value" :label="kpi.label" />
    </div>

    <h2 class="text-lg font-bold text-neutral-950 mb-3">Host controls</h2>
    <div class="grid gap-4 sm:grid-cols-2">
      <BaseCard v-for="control in controls" :key="control.title" class="flex items-start justify-between gap-4">
        <div>
          <h3 class="font-bold text-neutral-950 mb-1">{{ control.title }}</h3>
          <p class="text-sm text-neutral-500">{{ control.desc }}</p>
        </div>
        <BaseButton variant="outline" :disabled="true" class="shrink-0">{{ control.action }}</BaseButton>
      </BaseCard>
    </div>

    <BaseCard class="mt-6">
      <h3 class="font-bold text-neutral-950 mb-1">Activity</h3>
      <p class="text-sm text-neutral-500">
        Submission, judging, and publishing events from the audit log will stream here.
      </p>
    </BaseCard>
  </DashboardShell>
</template>
