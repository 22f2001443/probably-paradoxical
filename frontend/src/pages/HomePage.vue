<script setup>
import PublicLayout from '../components/layout/PublicLayout.vue'
import HeroSection from '../components/home/HeroSection.vue'
import EventOverviewSection from '../components/home/EventOverviewSection.vue'
import TimelinePreviewSection from '../components/home/TimelinePreviewSection.vue'
import PublicTeamsPreviewSection from '../components/home/PublicTeamsPreviewSection.vue'
import SocialFeedSection from '../components/home/SocialFeedSection.vue'
import CTASection from '../components/home/CTASection.vue'
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
