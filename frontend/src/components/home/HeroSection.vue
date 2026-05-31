<script setup>
import StatCard from '../common/StatCard.vue'
import BaseButton from '../common/BaseButton.vue'
import config from '../../data/content.yml'

const { hero, event } = config
const heroStats = hero.stats
</script>

<template>
  <section class="relative py-12 md:py-20 overflow-hidden">

    <!-- Subtle dot grid -->
    <div class="absolute inset-0 -z-10 opacity-[0.05] pointer-events-none" aria-hidden="true">
      <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="hero-grid" width="32" height="32" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="1" fill="black" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#hero-grid)" />
      </svg>
    </div>

    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center text-center">

      <!-- Eyebrow -->
      <div class="inline-flex items-center gap-2 px-3 py-1 border border-neutral-300 mb-5">
        <span class="text-xs font-semibold uppercase tracking-widest text-neutral-500">
          {{ hero.eyebrow }}
        </span>
      </div>

      <!-- Heading — scales down on small phones to prevent wrapping overflow -->
      <h1 class="text-3xl sm:text-5xl md:text-6xl font-bold text-neutral-950 tracking-tight leading-tight max-w-3xl">
        {{ hero.heading }}
      </h1>

      <!-- Tagline — from event.tagline in content.yml -->
      <p class="mt-4 text-base sm:text-xl font-semibold text-neutral-950 max-w-sm sm:max-w-xl tracking-tight leading-snug">
        {{ event.tagline }}
      </p>

      <!-- Subtitle -->
      <p class="mt-2 text-sm text-neutral-500 max-w-sm sm:max-w-xl">
        {{ hero.subtitle }}
      </p>

      <!-- Description -->
      <p class="mt-3 text-sm text-neutral-400 max-w-sm sm:max-w-xl leading-relaxed">
        {{ hero.description }}
      </p>

      <!-- CTAs — full-width when stacked on mobile, auto-width side-by-side on sm+ -->
      <div class="mt-7 flex flex-col sm:flex-row gap-3 w-full max-w-xs sm:max-w-none sm:w-auto">
        <BaseButton
          variant="primary"
          :href="hero.registrationUrl"
          :disabled="!hero.registrationUrl"
          class="w-full sm:w-auto"
        >
          {{ hero.registrationLabel }}
        </BaseButton>
        <BaseButton variant="outline" to="/guidelines" class="w-full sm:w-auto">
          View Guidelines
        </BaseButton>
        <BaseButton variant="outline" to="/login" class="w-full sm:w-auto">
          Team Login
        </BaseButton>
      </div>

      <!-- Stats row — 2-up on mobile, all five side-by-side on sm+ -->
      <div class="mt-10 grid grid-cols-2 sm:grid-cols-5 gap-px bg-neutral-200 border border-neutral-200 w-full max-w-xs sm:max-w-3xl">
        <StatCard
          v-for="stat in heroStats"
          :key="stat.label"
          :value="stat.value"
          :label="stat.label"
        />
      </div>

    </div>
  </section>
</template>
