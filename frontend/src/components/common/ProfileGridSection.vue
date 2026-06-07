<script setup>
import { mdiLinkedin, mdiWeb } from '@mdi/js'
import SectionHeader from './SectionHeader.vue'
import BaseCard from './BaseCard.vue'

defineProps({
  /** Small uppercase label shown above the section heading. */
  eyebrow: { type: String, default: null },
  /** Main section heading. */
  heading: { type: String, required: true },
  /** Supporting text shown below the heading. */
  subheading: { type: String, default: null },
  /** Profile cards to render in the grid. */
  profiles: { type: Array, default: () => [] },
  /** Empty-state text shown when no profiles are configured. */
  emptyMessage: { type: String, default: 'Profiles coming soon.' },
  /** Placeholder text shown inside profile cards with no image. */
  imagePlaceholder: { type: String, default: 'Photo coming soon' },
  /** Adds a top border when the section follows another profile section. */
  bordered: { type: Boolean, default: false },
})

function profileLinks(person) {
  const linkedInUrl = firstString(person, ['linkedinUrl', 'linkedInUrl', 'LinkedInUrl'])
  const websiteUrl = firstString(person, ['websiteUrl', 'WebsiteUrl'])

  return [
    linkedInUrl ? { label: 'LinkedIn', url: linkedInUrl, icon: mdiLinkedin } : null,
    websiteUrl ? { label: 'Website', url: websiteUrl, icon: mdiWeb } : null,
  ].filter(Boolean)
}

function firstString(source, keys) {
  for (const key of keys) {
    const value = source?.[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return ''
}
</script>

<template>
  <section
    class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-14"
    :class="bordered ? 'border-t border-neutral-200' : ''"
  >
    <SectionHeader
      :eyebrow="eyebrow"
      :heading="heading"
      :subheading="subheading"
    />

    <div
      v-if="profiles.length"
      class="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
    >
      <BaseCard
        v-for="person in profiles"
        :key="person.name"
      >
        <div class="aspect-4/3 bg-neutral-50 border border-neutral-100 mb-4 flex items-center justify-center overflow-hidden">
          <img
            v-if="person.imageUrl"
            :src="person.imageUrl"
            :alt="`${person.name} portrait`"
            class="w-full h-full object-cover"
            loading="lazy"
          >
          <p v-else class="text-xs uppercase tracking-widest text-neutral-300">
            {{ imagePlaceholder }}
          </p>
        </div>
        <h3 class="text-base font-bold text-neutral-950">{{ person.name }}</h3>
        <p v-if="person.role" class="mt-1 text-sm font-medium text-violet-700">
          {{ person.role }}
        </p>
        <p v-if="person.bio" class="mt-3 text-sm text-neutral-500 leading-relaxed">
          {{ person.bio }}
        </p>
        <div
          v-if="profileLinks(person).length"
          class="mt-4 flex items-center gap-2"
        >
          <a
            v-for="link in profileLinks(person)"
            :key="link.label"
            :href="link.url"
            :aria-label="`${person.name} ${link.label}`"
            :title="link.label"
            target="_blank"
            rel="noopener noreferrer"
            class="w-9 h-9 flex items-center justify-center border border-neutral-200 text-neutral-500 transition-colors hover:border-violet-600 hover:text-violet-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="w-4 h-4" aria-hidden="true">
              <path fill="currentColor" :d="link.icon" />
            </svg>
          </a>
        </div>
      </BaseCard>
    </div>

    <div
      v-else
      class="mt-8 border border-dashed border-neutral-300 bg-neutral-50 min-h-48 flex items-center justify-center py-10"
    >
      <p class="text-sm text-neutral-400">{{ emptyMessage }}</p>
    </div>
  </section>
</template>
