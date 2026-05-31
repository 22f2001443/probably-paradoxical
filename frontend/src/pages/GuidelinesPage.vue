<script setup>
import PublicLayout from '../components/layout/PublicLayout.vue'
import SectionHeader from '../components/common/SectionHeader.vue'
import config from '../data/content.yml'

function toGoogleDocsEmbedUrl(url) {
  if (!url || !url.trim()) return null
  const match = url.match(/\/document\/d\/([a-zA-Z0-9_-]+)/)
  if (!match) return null
  return `https://docs.google.com/document/d/${match[1]}/preview`
}

const embedUrl = toGoogleDocsEmbedUrl(config.guidelines?.googleDocUrl)
</script>

<template>
  <PublicLayout>
    <section class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-14">

      <SectionHeader
        eyebrow="Rules & format"
        heading="Event Guidelines"
        :subheading="embedUrl
          ? 'Document embedded from Google Docs — always shows the latest version.'
          : 'Full guidelines will be published here before Stage 0.'"
      />

      <div class="mt-8">
        <!-- Google Doc embed — full viewport height on all screen sizes -->
        <iframe
          v-if="embedUrl"
          :src="embedUrl"
          title="Event Guidelines"
          class="w-full border border-neutral-200"
          style="height: clamp(400px, 75vh, 1000px);"
          loading="lazy"
          allowfullscreen
        />

        <!-- Placeholder -->
        <div
          v-else
          class="border border-dashed border-neutral-300 bg-neutral-50 min-h-48 flex flex-col items-center justify-center gap-2 text-center px-6 py-10"
        >
          <p class="text-sm text-neutral-400">Guidelines document not yet published.</p>
          <p class="text-xs text-neutral-300 max-w-xs leading-relaxed">
            Paste your Google Doc link into
            <code class="font-mono bg-white border border-neutral-200 px-1 py-0.5 text-neutral-500 break-all">
              guidelines.googleDocUrl
            </code>
            in <code class="font-mono bg-white border border-neutral-200 px-1 py-0.5 text-neutral-500">content.yml</code>
            and it will embed automatically.
          </p>
        </div>
      </div>

    </section>
  </PublicLayout>
</template>
