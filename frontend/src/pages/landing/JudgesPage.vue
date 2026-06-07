<script setup>
import PublicLayout from '../../components/layout/PublicLayout.vue'
import ProfileGridSection from '../../components/common/ProfileGridSection.vue'
import config from '../../data/content.yml'

const { judges, speakers } = config
const profileSections = [judges, speakers]
</script>

<template>
  <PublicLayout>
    <ProfileGridSection
      v-for="(section, index) in profileSections"
      :key="section.heading"
      :eyebrow="section.eyebrow"
      :heading="section.heading"
      :subheading="section.subheading"
      :profiles="section.profiles"
      :empty-message="section.emptyMessage"
      :image-placeholder="section.imagePlaceholder"
      :bordered="index > 0"
    />
  </PublicLayout>
</template>
