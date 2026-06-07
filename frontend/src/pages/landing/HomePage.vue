<script setup>
import PublicLayout from '../../components/layout/PublicLayout.vue'
import HeroSection from '../../components/landing/HeroSection.vue'
import EventOverviewSection from '../../components/landing/EventOverviewSection.vue'
import TimelinePreviewSection from '../../components/landing/TimelinePreviewSection.vue'
import PublicTeamsPreviewSection from '../../components/landing/PublicTeamsPreviewSection.vue'
import SocialFeedSection from '../../components/landing/SocialFeedSection.vue'
import CTASection from '../../components/landing/CTASection.vue'
</script>

<template>
  <PublicLayout>
    <HeroSection />
    <EventOverviewSection />
    <TimelinePreviewSection />
    <PublicTeamsPreviewSection />
    <SocialFeedSection />
    <CTASection />
  </PublicLayout>
</template>
