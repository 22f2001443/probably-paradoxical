<script setup>
import SectionHeader from '../common/SectionHeader.vue'
import BaseCard from '../common/BaseCard.vue'
import { overviewCards } from '../../data/eventData.js'

import {
  mdiMagnify,
  mdiChartBar,
  mdiTableLarge,
  mdiPresentationPlay,
} from '@mdi/js'

const iconMap = { mdiMagnify, mdiChartBar, mdiTableLarge, mdiPresentationPlay }
</script>

<template>
  <section class="py-10 md:py-12 border-t border-neutral-200">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

      <SectionHeader
        eyebrow="What happens"
        heading="Event Overview"
        subheading="A structured, data-driven competition that takes teams from raw curiosity to evidence-based insight."
        align="center"
      />

      <!-- 1-col mobile → 2-col tablet → 4-col desktop, flush gap-px grid -->
      <div class="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-neutral-200 border border-neutral-200">
        <BaseCard
          v-for="card in overviewCards"
          :key="card.title"
          hoverable
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="w-5 h-5 text-neutral-950 mb-3"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path fill="currentColor" :d="iconMap[card.icon]" />
          </svg>
          <h3 class="text-sm font-bold text-neutral-950 mb-1.5 group-hover:text-neutral-600 transition-colors">
            {{ card.title }}
          </h3>
          <p class="text-xs text-neutral-500 leading-relaxed">
            {{ card.description }}
          </p>
        </BaseCard>
      </div>

    </div>
  </section>
</template>
