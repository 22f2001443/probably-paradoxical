<script setup>
import { mdiPlayCircleOutline } from '@mdi/js'
import PublicLayout from '../../components/layout/PublicLayout.vue'
import SectionHeader from '../../components/common/SectionHeader.vue'
import StatusBadge from '../../components/common/StatusBadge.vue'
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

const stageTitleClasses = (stage) =>
  stage.tone === 'violet' ? 'text-violet-700' : 'text-neutral-950'
</script>

<template>
  <PublicLayout>
    <section class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-14">
      <SectionHeader
        :eyebrow="timelineMeta.eyebrow"
        heading="Full Event Timeline"
        :subheading="timelineMeta.subheading"
      />

      <ol class="relative border-l-2 border-neutral-200 ml-3 mt-10 space-y-0">
        <li
          v-for="stage in timelineStages"
          :key="stage.stage"
          class="relative pl-6 pb-9 last:pb-0"
        >
          <span
            class="absolute -left-2.25 top-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center text-[9px] font-bold"
            :class="statusDotClasses(stage)"
            aria-hidden="true"
          >{{ stage.stage }}</span>

          <div class="flex flex-wrap items-center gap-2 mb-1.5">
            <h3 class="text-sm font-bold" :class="stageTitleClasses(stage)">
              Stage {{ stage.stage }}: {{ stage.title }}
            </h3>
            <StatusBadge :status="stage.status" :tone="stage.tone" />
            <span v-if="stage.date" class="text-xs text-neutral-400">
              {{ stage.date }}
            </span>
            <span v-if="stage.location" class="text-xs font-medium text-neutral-500">
              · {{ stage.location }}
            </span>
          </div>
          <p class="text-sm text-neutral-500 leading-relaxed max-w-2xl">
            {{ stage.description }}
          </p>
          <a
            v-if="stage.recordingUrl"
            :href="stage.recordingUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="mt-3 inline-flex items-center gap-1.5 text-sm font-bold text-violet-600 hover:text-violet-700"
          >
            <svg viewBox="0 0 24 24" class="w-4 h-4" aria-hidden="true">
              <path fill="currentColor" :d="mdiPlayCircleOutline" />
            </svg>
            Watch recording
          </a>
        </li>
      </ol>
    </section>
  </PublicLayout>
</template>
