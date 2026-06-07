<script setup>
import { computed, ref } from 'vue'
import { mdiChevronLeft, mdiChevronRight } from '@mdi/js'
import SectionHeader from '../common/SectionHeader.vue'
import BaseButton from '../common/BaseButton.vue'
import config from '../../data/content.yml'
import teamInfo from '../../data/teamInfo.yml'

const teamsContent = config.teams
const PER_PAGE = 6
const page = ref(0)
const confirmedTeams = computed(() =>
  teamInfo.teams.filter((team) => team.teamId !== 'unclustered')
)
const totalPages = computed(() => Math.ceil(confirmedTeams.value.length / PER_PAGE))
const canPrev = computed(() => page.value > 0)
const canNext = computed(() => page.value < totalPages.value - 1)
const pageTeams = computed(() =>
  confirmedTeams.value.slice(page.value * PER_PAGE, (page.value + 1) * PER_PAGE)
)

function prev() { if (canPrev.value) page.value-- }
function next() { if (canNext.value) page.value++ }
</script>

<template>
  <section class="py-10 md:py-12 border-t border-neutral-200 bg-neutral-50">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

      <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-8">
        <SectionHeader
          :eyebrow="teamsContent.eyebrow"
          :heading="teamsContent.heading"
          :subheading="teamsContent.subheading"
        />
        <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
          <div v-if="totalPages > 1" class="flex items-center gap-2">
            <button
              :disabled="!canPrev"
              aria-label="Previous teams"
              class="w-11 h-11 flex items-center justify-center border border-neutral-300 bg-white transition-colors hover:border-neutral-950 disabled:opacity-30 disabled:cursor-not-allowed"
              @click="prev"
            >
              <svg viewBox="0 0 24 24" class="w-4 h-4" aria-hidden="true">
                <path fill="currentColor" :d="mdiChevronLeft" />
              </svg>
            </button>
            <span class="text-xs text-neutral-400 tabular-nums w-10 text-center">
              {{ page + 1 }} / {{ totalPages }}
            </span>
            <button
              :disabled="!canNext"
              aria-label="Next teams"
              class="w-11 h-11 flex items-center justify-center border border-neutral-300 bg-white transition-colors hover:border-neutral-950 disabled:opacity-30 disabled:cursor-not-allowed"
              @click="next"
            >
              <svg viewBox="0 0 24 24" class="w-4 h-4" aria-hidden="true">
                <path fill="currentColor" :d="mdiChevronRight" />
              </svg>
            </button>
          </div>
          <BaseButton variant="outline" to="/teams" class="w-full sm:w-auto">
            View All Teams
          </BaseButton>
        </div>
      </div>

      <!-- 2-col on all mobile, 3-col tablet, 6-col desktop -->
      <div
        v-if="confirmedTeams.length"
        class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3"
      >
        <article
          v-for="team in pageTeams"
          :key="team.teamId"
          class="border border-neutral-300 bg-white h-16 sm:h-20 px-2 flex flex-col items-center justify-center text-center"
        >
          <h3 class="text-xs font-semibold text-neutral-950 truncate w-full">{{ team.teamName }}</h3>
          <p class="mt-1 text-[10px] uppercase tracking-wider text-neutral-400">{{ team.teamId }}</p>
        </article>
      </div>

      <div
        v-else
        class="border border-dashed border-neutral-300 bg-white h-16 sm:h-20 flex items-center justify-center"
      >
        <p class="text-xs text-neutral-400">{{ teamsContent.emptyMessage }}</p>
      </div>

      <div
        v-if="totalPages > 1"
        class="flex justify-center gap-2 mt-5"
        role="tablist"
        aria-label="Team carousel pages"
      >
        <button
          v-for="n in totalPages"
          :key="n"
          :aria-label="`Team page ${n}`"
          :aria-selected="page === n - 1"
          class="w-2 h-2 rounded-full transition-colors"
          :class="page === n - 1 ? 'bg-neutral-950' : 'bg-neutral-300 hover:bg-neutral-500'"
          @click="page = n - 1"
        />
      </div>

    </div>
  </section>
</template>
