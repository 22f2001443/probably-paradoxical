<script setup>
import { mdiPlayCircleOutline } from '@mdi/js'
import SectionHeader from '../common/SectionHeader.vue'
import StatusBadge from '../common/StatusBadge.vue'
import BaseButton from '../common/BaseButton.vue'
import { timelineMeta, timelineStages } from '../../data/eventData.js'

const statusDotClasses = (stage) => {
  if (stage.tone === 'violet') {
    return stage.status === 'completed'
      ? 'bg-violet-600 border-violet-600 text-white'
      : 'bg-white border-violet-600 text-violet-700'
  }

  if (stage.status === 'completed') return 'bg-neutral-950 border-neutral-950 text-white'
  if (stage.status === 'active') return 'bg-white border-neutral-950 text-neutral-950'
  return 'bg-white border-neutral-300 text-neutral-400'
}

const stageLabelClasses = (stage) => {
  if (stage.tone === 'violet') return 'text-violet-700'
  return stage.status === 'active' ? 'text-neutral-950' : 'text-neutral-400'
}

const stageTitleClasses = (stage) =>
  stage.tone === 'violet' ? 'text-violet-700' : 'text-neutral-950'

// RJN venues are being relocated — show them struck through.
const isRjn = (loc) => typeof loc === 'string' && loc.trim().toUpperCase().startsWith('RJN')
</script>

<template>
  <section class="py-10 md:py-12 border-t border-neutral-200">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

      <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-8">
        <SectionHeader
          :eyebrow="timelineMeta.eyebrow"
          :heading="timelineMeta.heading"
          :subheading="timelineMeta.subheading"
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
            :class="statusDotClasses(stage)"
            aria-hidden="true"
          >{{ stage.stage }}</span>

          <!-- Stage label + content — stacked on mobile, inline on sm+ -->
          <div class="flex flex-col sm:flex-row sm:items-start sm:gap-3">
            <span
              class="mb-1 sm:mb-0 sm:mt-0.5 text-xs font-bold uppercase tracking-widest shrink-0 w-10"
              :class="stageLabelClasses(stage)"
            >
              S{{ stage.stage }}
            </span>
            <div class="flex-1 min-w-0">
              <div class="flex flex-wrap items-center gap-2 mb-1">
                <h3 class="text-sm font-bold" :class="stageTitleClasses(stage)">
                  {{ stage.title }}
                </h3>
                <StatusBadge :status="stage.status" :tone="stage.tone" />
                <span v-if="stage.date" class="text-xs text-neutral-400">
                  {{ stage.date }}
                </span>
                <span v-if="stage.location || stage.newVenue" class="text-xs font-medium text-neutral-500">
                  ·
                  <span v-if="stage.location" :class="{ 'line-through text-neutral-400': isRjn(stage.location) }">{{ stage.location }}</span>
                  <span v-if="stage.newVenue" class="text-neutral-700 font-semibold">
                    <template v-if="stage.location"> → </template>{{ stage.newVenue }}
                  </span>
                </span>
              </div>
              <p class="text-xs text-neutral-500 leading-relaxed">{{ stage.description }}</p>
              <a
                v-if="stage.recordingUrl"
                :href="stage.recordingUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-violet-600 hover:text-violet-700"
              >
                <svg viewBox="0 0 24 24" class="w-4 h-4" aria-hidden="true">
                  <path fill="currentColor" :d="mdiPlayCircleOutline" />
                </svg>
                Watch recording
              </a>
            </div>
          </div>
        </li>
      </ol>

    </div>
  </section>
</template>
