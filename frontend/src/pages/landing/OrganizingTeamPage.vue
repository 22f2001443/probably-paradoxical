<script setup>
import PublicLayout from '../../components/layout/PublicLayout.vue'
import ProfileGridSection from '../../components/common/ProfileGridSection.vue'
import config from '../../data/content.yml'

const { organizingTeam } = config
</script>

<template>
  <PublicLayout>
    <ProfileGridSection
      :eyebrow="organizingTeam.eyebrow"
      :heading="organizingTeam.heading"
      :subheading="organizingTeam.subheading"
      :profiles="organizingTeam.profiles"
      :empty-message="organizingTeam.emptyMessage"
      :image-placeholder="organizingTeam.imagePlaceholder"
    />
  </PublicLayout>
</template>
