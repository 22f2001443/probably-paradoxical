<script setup>
import BaseButton from '../common/BaseButton.vue'
</script>

<template>
  <section class="py-10 md:py-12 border-t border-neutral-200">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex flex-col md:flex-row items-center justify-between gap-6 py-8 px-4 sm:px-6 border border-neutral-950 bg-white">

        <div class="max-w-lg text-center md:text-left">
          <p class="text-xs font-semibold uppercase tracking-widest text-neutral-400 mb-1.5">Get started</p>
          <h2 class="text-xl sm:text-2xl font-bold text-neutral-950 tracking-tight">
            Ready to explore your paradox?
          </h2>
          <p class="mt-2 text-sm text-neutral-500 leading-relaxed">
            Once your team credentials are shared, log in to access your dashboard,
            submit materials at each stage, and track your progress.
          </p>
        </div>

        <!-- Buttons — full-width stacked on mobile, auto side-by-side on sm+ -->
        <div class="flex flex-col sm:flex-row gap-3 w-full md:w-auto shrink-0">
          <BaseButton variant="primary" to="/login" class="w-full sm:w-auto">
            Go to Team Login
          </BaseButton>
          <BaseButton variant="outline" to="/guidelines" class="w-full sm:w-auto">
            Read the Guidelines
          </BaseButton>
        </div>

      </div>
    </div>
  </section>
</template>
