<script setup>
import PublicLayout from '../components/layout/PublicLayout.vue'
import BaseButton from '../components/common/BaseButton.vue'
</script>

<template>
  <PublicLayout>
    <section class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 flex flex-col items-center text-center">
      <p class="text-7xl sm:text-8xl font-bold text-neutral-100 select-none leading-none" aria-hidden="true">
        404
      </p>
      <h1 class="mt-4 text-xl font-bold text-neutral-950">Page not found</h1>
      <p class="mt-2 text-sm text-neutral-500 max-w-xs">
        The page you're looking for doesn't exist or has been moved.
      </p>
      <BaseButton variant="primary" to="/" class="mt-7">
        Back to Home
      </BaseButton>
    </section>
  </PublicLayout>
</template>
