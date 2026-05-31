<script setup>
import PublicLayout from '../components/layout/PublicLayout.vue'
import SectionHeader from '../components/common/SectionHeader.vue'
import BaseCard from '../components/common/BaseCard.vue'
import config from '../data/content.yml'

const { judges, speakers } = config
const profileSections = [judges, speakers]
</script>

<template>
  <PublicLayout>
    <section
      v-for="(section, index) in profileSections"
      :key="section.heading"
      class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-14"
      :class="index > 0 ? 'border-t border-neutral-200' : ''"
    >
      <SectionHeader
        :eyebrow="section.eyebrow"
        :heading="section.heading"
        :subheading="section.subheading"
      />

      <div
        v-if="section.profiles.length"
        class="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
      >
        <BaseCard
          v-for="person in section.profiles"
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
              {{ section.imagePlaceholder }}
            </p>
          </div>
          <h3 class="text-base font-bold text-neutral-950">{{ person.name }}</h3>
          <p v-if="person.role" class="mt-1 text-sm font-medium text-violet-700">
            {{ person.role }}
          </p>
          <p v-if="person.bio" class="mt-3 text-sm text-neutral-500 leading-relaxed">
            {{ person.bio }}
          </p>
        </BaseCard>
      </div>

      <div
        v-else
        class="mt-8 border border-dashed border-neutral-300 bg-neutral-50 min-h-48 flex items-center justify-center py-10"
      >
        <p class="text-sm text-neutral-400">{{ section.emptyMessage }}</p>
      </div>
    </section>
  </PublicLayout>
</template>
