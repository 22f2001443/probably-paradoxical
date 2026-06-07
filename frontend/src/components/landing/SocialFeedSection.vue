<script setup>
import { ref, computed } from 'vue'
import {
  mdiInstagram,
  mdiYoutube,
  mdiLinkedin,
  mdiChevronLeft,
  mdiChevronRight,
} from '@mdi/js'
import SectionHeader from '../common/SectionHeader.vue'
import config from '../../data/content.yml'

const { heading, subheading, feeds } = config.social

const platformMeta = {
  instagram: { icon: mdiInstagram, label: 'Instagram' },
  youtube:   { icon: mdiYoutube,   label: 'YouTube'   },
  linkedin:  { icon: mdiLinkedin,  label: 'LinkedIn'  },
}

const PER_PAGE   = 3
const page       = ref(0)
const totalPages = computed(() => Math.ceil(feeds.length / PER_PAGE))
const canPrev    = computed(() => page.value > 0)
const canNext    = computed(() => page.value < totalPages.value - 1)

const pageFeeds = computed(() =>
  feeds.slice(page.value * PER_PAGE, (page.value + 1) * PER_PAGE)
)

function prev() { if (canPrev.value) page.value-- }
function next() { if (canNext.value) page.value++ }
</script>

<template>
  <section class="py-10 md:py-12 border-t border-neutral-200">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

      <!-- Section header + carousel controls -->
      <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-6 sm:mb-8">
        <SectionHeader :heading="heading" :subheading="subheading" />

        <div v-if="totalPages > 1" class="flex items-center gap-2 shrink-0">
          <button
            :disabled="!canPrev"
            aria-label="Previous"
            class="w-11 h-11 flex items-center justify-center border border-neutral-300 transition-colors hover:border-neutral-950 disabled:opacity-30 disabled:cursor-not-allowed"
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
            aria-label="Next"
            class="w-11 h-11 flex items-center justify-center border border-neutral-300 transition-colors hover:border-neutral-950 disabled:opacity-30 disabled:cursor-not-allowed"
            @click="next"
          >
            <svg viewBox="0 0 24 24" class="w-4 h-4" aria-hidden="true">
              <path fill="currentColor" :d="mdiChevronRight" />
            </svg>
          </button>
        </div>
      </div>

      <!-- Feed grid: 1-col mobile → 2-col tablet → 3-col desktop -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-neutral-200 border border-neutral-200">
        <article
          v-for="(feed, idx) in pageFeeds"
          :key="`${page}-${idx}`"
          class="bg-white flex flex-col"
        >
          <!-- Platform header bar -->
          <header class="flex items-center gap-2 px-4 py-3 border-b border-neutral-100">
            <svg viewBox="0 0 24 24" class="w-4 h-4 text-neutral-950 shrink-0" aria-hidden="true">
              <path fill="currentColor" :d="platformMeta[feed.platform]?.icon" />
            </svg>
            <span class="text-xs font-bold uppercase tracking-widest text-neutral-500">
              {{ platformMeta[feed.platform]?.label ?? feed.platform }}
            </span>
            <span
              v-if="feed.label"
              class="ml-auto text-xs text-neutral-400 truncate max-w-32"
            >
              {{ feed.label }}
            </span>
          </header>

          <!-- Embed area:
               Shorter on mobile (h-72 = 288px) to avoid a single card
               consuming the entire screen; taller on sm+ (h-[450px]) -->
          <div class="relative flex-1 h-72 sm:h-112.5">
            <iframe
              v-if="feed.embedUrl"
              :src="feed.embedUrl"
              :title="feed.label || platformMeta[feed.platform]?.label"
              class="absolute inset-0 w-full h-full border-0"
              loading="lazy"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowfullscreen
            />

            <div
              v-else
              class="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-neutral-50 px-6 text-center"
            >
              <svg viewBox="0 0 24 24" class="w-9 h-9 text-neutral-200" aria-hidden="true">
                <path fill="currentColor" :d="platformMeta[feed.platform]?.icon" />
              </svg>
              <p class="text-xs text-neutral-400 leading-relaxed">
                {{ platformMeta[feed.platform]?.label ?? feed.platform }} embed pending.
              </p>
              <p class="text-[11px] text-neutral-300 leading-relaxed">
                Add the embed URL to
                <code class="font-mono bg-white border border-neutral-100 px-1">content.yml</code>
                → <code class="font-mono bg-white border border-neutral-100 px-1">social.feeds</code>
              </p>
            </div>
          </div>
        </article>
      </div>

      <!-- Dot indicators -->
      <div
        v-if="totalPages > 1"
        class="flex justify-center gap-2 mt-5"
        role="tablist"
        aria-label="Carousel pages"
      >
        <button
          v-for="n in totalPages"
          :key="n"
          :aria-label="`Page ${n}`"
          :aria-selected="page === n - 1"
          class="w-2 h-2 rounded-full transition-colors"
          :class="page === n - 1 ? 'bg-neutral-950' : 'bg-neutral-300 hover:bg-neutral-500'"
          @click="page = n - 1"
        />
      </div>

    </div>
  </section>
</template>
