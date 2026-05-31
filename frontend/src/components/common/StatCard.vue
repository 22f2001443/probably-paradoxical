<script setup>
defineProps({
  value: { type: String, required: true },
  label: { type: String, required: true },
})
</script>

<template>
  <div class="flex flex-col items-center text-center px-4 py-4 border border-neutral-200 bg-white">
    <span class="text-2xl font-bold text-neutral-950 leading-none">{{ value }}</span>
    <span class="mt-1 text-xs font-medium uppercase tracking-widest text-neutral-500">{{ label }}</span>
  </div>
</template>
