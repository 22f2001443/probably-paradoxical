<script setup>
import SectionHeader from '../common/SectionHeader.vue'
import StatusBadge from '../common/StatusBadge.vue'
import BaseButton from '../common/BaseButton.vue'
import { timelineStages } from '../../data/eventData.js'
</script>

<template>
  <section class="py-10 md:py-12 border-t border-neutral-200">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

      <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-8">
        <SectionHeader
          eyebrow="Five stages"
          heading="Event Timeline"
          subheading="From problem statement to final presentation."
        />
        <BaseButton variant="ghost" to="/timeline">Full timeline →</BaseButton>
      </div>

      <ol class="relative border-l-2 border-neutral-200 ml-3 space-y-0">
        <li
          v-for="stage in timelineStages"
          :key="stage.stage"
          class="relative pl-6 pb-7 last:pb-0"
        >
          <!-- Connector dot -->
          <span
            class="absolute -left-2.25 top-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center text-[9px] font-bold"
            :class="stage.status === 'completed'
              ? 'bg-neutral-950 border-neutral-950 text-white'
              : stage.status === 'active'
              ? 'bg-white border-neutral-950 text-neutral-950'
              : 'bg-white border-neutral-300 text-neutral-400'"
            aria-hidden="true"
          >{{ stage.stage }}</span>

          <!-- Stage label + content — stacked on mobile, inline on sm+ -->
          <div class="flex flex-col sm:flex-row sm:items-start sm:gap-3">
            <span
              class="mb-1 sm:mb-0 sm:mt-0.5 text-xs font-bold uppercase tracking-widest shrink-0 w-10"
              :class="stage.status === 'active' ? 'text-neutral-950' : 'text-neutral-400'"
            >
              S{{ stage.stage }}
            </span>
            <div class="flex-1 min-w-0">
              <div class="flex flex-wrap items-center gap-2 mb-1">
                <h3 class="text-sm font-bold text-neutral-950">{{ stage.title }}</h3>
                <StatusBadge :status="stage.status" />
              </div>
              <p class="text-xs text-neutral-500 leading-relaxed">{{ stage.description }}</p>
            </div>
          </div>
        </li>
      </ol>

    </div>
  </section>
</template>
