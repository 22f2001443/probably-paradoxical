<script setup>
import PublicLayout from '../layout/PublicLayout.vue'

defineProps({
  /** Small eyebrow label above the title (e.g. the role). */
  eyebrow: { type: String, default: '' },
  title: { type: String, default: '' },
})
</script>

<template>
  <PublicLayout>
    <section class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
      <div class="mb-8">
        <p v-if="eyebrow" class="text-xs font-semibold uppercase tracking-widest text-violet-600 mb-1">
          {{ eyebrow }}
        </p>
        <h1 class="text-2xl md:text-3xl font-bold text-neutral-950">{{ title }}</h1>
      </div>

      <slot />
    </section>
  </PublicLayout>
</template>
