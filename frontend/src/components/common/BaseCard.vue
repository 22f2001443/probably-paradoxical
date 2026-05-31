<script setup>
defineProps({
  /** thickens the border and lifts the card on hover */
  hoverable: {
    type: Boolean,
    default: false,
  },
})
</script>

<template>
  <div
    class="bg-white border border-neutral-200 p-5 transition-all duration-150"
    :class="hoverable ? 'group hover:border-neutral-950 hover:-translate-y-0.5' : ''"
  >
    <slot />
  </div>
</template>
