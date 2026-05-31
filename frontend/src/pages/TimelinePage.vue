<script setup>
import PublicLayout from '../components/layout/PublicLayout.vue'
import SectionHeader from '../components/common/SectionHeader.vue'
import StatusBadge from '../components/common/StatusBadge.vue'
import { timelineStages } from '../data/eventData.js'
</script>

<template>
  <PublicLayout>
    <section class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-14">
      <SectionHeader
        eyebrow="Five stages"
        heading="Full Event Timeline"
        subheading="Stage-by-stage breakdown of the competition from problem release to final presentation."
      />

      <ol class="relative border-l-2 border-neutral-200 ml-3 mt-10 space-y-0">
        <li
          v-for="stage in timelineStages"
          :key="stage.stage"
          class="relative pl-6 pb-9 last:pb-0"
        >
          <span
            class="absolute -left-2.25 top-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center text-[9px] font-bold"
            :class="stage.status === 'completed'
              ? 'bg-neutral-950 border-neutral-950 text-white'
              : stage.status === 'active'
              ? 'bg-white border-neutral-950 text-neutral-950'
              : 'bg-white border-neutral-300 text-neutral-400'"
            aria-hidden="true"
          >{{ stage.stage }}</span>

          <div class="flex flex-wrap items-center gap-2 mb-1.5">
            <h3 class="text-sm font-bold text-neutral-950">
              Stage {{ stage.stage }}: {{ stage.title }}
            </h3>
            <StatusBadge :status="stage.status" />
          </div>
          <p class="text-sm text-neutral-500 leading-relaxed max-w-2xl">
            {{ stage.description }}
          </p>
        </li>
      </ol>
    </section>
  </PublicLayout>
</template>
