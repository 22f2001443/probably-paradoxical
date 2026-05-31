<script setup>
defineProps({
  /** 'completed' | 'active' | 'upcoming' */
  status: {
    type: String,
    default: 'upcoming',
  },
})

const classes = {
  completed: 'bg-neutral-950 text-white',
  active:    'bg-neutral-200 text-neutral-950 font-bold',
  upcoming:  'border border-neutral-300 text-neutral-400',
}

const labels = {
  completed: 'Done',
  active:    'Active',
  upcoming:  'Upcoming',
}
</script>

<template>
  <span
    class="inline-flex items-center px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider"
    :class="classes[status] ?? classes.upcoming"
  >
    {{ labels[status] ?? status }}
  </span>
</template>
