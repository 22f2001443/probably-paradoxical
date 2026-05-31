<script setup>
defineProps({
  eyebrow: { type: String, default: null },
  heading: { type: String, required: true },
  subheading: { type: String, default: null },
  /** 'left' | 'center' */
  align: { type: String, default: 'left' },
})
</script>

<template>
  <div :class="align === 'center' ? 'text-center' : 'text-left'">
    <p
      v-if="eyebrow"
      class="text-xs font-semibold uppercase tracking-widest text-neutral-400 mb-1.5"
    >
      {{ eyebrow }}
    </p>
    <h2 class="text-xl sm:text-2xl font-bold text-neutral-950 tracking-tight">
      {{ heading }}
    </h2>
    <p
      v-if="subheading"
      class="mt-2 text-sm text-neutral-500 max-w-2xl leading-relaxed"
      :class="align === 'center' ? 'mx-auto' : ''"
    >
      {{ subheading }}
    </p>
  </div>
</template>
