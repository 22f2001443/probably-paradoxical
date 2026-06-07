<script setup>
import { computed } from 'vue'
import PublicLayout from '../../components/layout/PublicLayout.vue'
import SectionHeader from '../../components/common/SectionHeader.vue'
import BaseCard from '../../components/common/BaseCard.vue'
import config from '../../data/content.yml'
import teamInfo from '../../data/teamInfo.yml'

const teamsContent = config.teams
const unclusteredTeam = computed(() =>
  teamInfo.teams.find((team) => team.teamId === 'unclustered')
)
const confirmedTeams = computed(() =>
  teamInfo.teams.filter((team) => team.teamId !== 'unclustered')
)

// Border colour by team composition:
//   blue  → invalid size (more than 5, or only 1 member) — takes priority
//   green → pure team
//   red   → non-pure team
function borderClass(team) {
  const count = team.members.length
  if (count > 5 || count === 1) return '!border-blue-600'
  return team.pure ? '!border-green-600' : '!border-red-600'
}
</script>

<template>
  <PublicLayout>
    <section class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-14">
      <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <SectionHeader
          :eyebrow="teamsContent.eyebrow"
          :heading="teamsContent.heading"
          :subheading="teamsContent.subheading"
        />
        <p class="text-xs text-neutral-400 shrink-0">
          {{ teamsContent.lastUpdatedLabel }}
          <time :datetime="teamInfo.lastUpdatedIso">{{ teamInfo.lastUpdated }}</time>
        </p>
      </div>

      <div
        v-if="confirmedTeams.length"
        class="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
      >
        <BaseCard
          v-for="(team, index) in confirmedTeams"
          :key="`${team.teamId}-${index}`"
          class="relative !border-2"
          :class="borderClass(team)"
        >
          <div
            class="absolute top-4 right-4 flex flex-col items-center gap-1"
            aria-label="Team ID"
          >
            <span class="w-12 h-12 border border-neutral-950 flex items-center justify-center p-1 text-center text-[11px] font-bold uppercase tracking-wide text-neutral-950 break-all">
              {{ team.teamId }}
            </span>
            <span class="text-[10px] uppercase tracking-wider text-neutral-400">Team ID</span>
          </div>
          <h3 class="pr-16 text-base font-bold text-neutral-950">{{ team.teamName }}</h3>
          <ul class="mt-4 space-y-3">
            <li
              v-for="(member, memberIndex) in team.members"
              :key="member.email"
            >
              <div class="flex flex-wrap items-center gap-2">
                <p class="text-sm font-medium text-neutral-950">{{ member.name }}</p>
                <span
                  v-if="memberIndex === 0"
                  class="inline-flex items-center px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-violet-600 text-white"
                >
                  Lead
                </span>
                <span
                  v-if="member.tag === 'unregistered'"
                  class="inline-flex items-center px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-red-600 text-white"
                >
                  {{ member.tag }}
                </span>
              </div>
              <a
                :href="`mailto:${member.email}`"
                class="text-sm text-violet-700 hover:underline underline-offset-2 break-all"
              >
                {{ member.email }}
              </a>
            </li>
          </ul>
        </BaseCard>
      </div>

      <div
        v-else
        class="mt-8 border border-dashed border-neutral-300 bg-neutral-50 min-h-48 flex items-center justify-center py-10"
      >
        <p class="text-sm text-neutral-400">{{ teamsContent.emptyMessage }}</p>
      </div>

      <section v-if="unclusteredTeam?.members.length" class="mt-12 border-t border-neutral-200 pt-10">
        <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <p class="text-xs font-semibold uppercase tracking-widest text-violet-600">
              {{ teamsContent.unclustered.eyebrow }}
            </p>
            <h2 class="mt-2 text-2xl font-bold tracking-tight text-neutral-950">
              {{ teamsContent.unclustered.heading }}
            </h2>
            <p class="mt-2 text-sm font-medium text-red-600">
              {{ teamsContent.unclustered.subheading }}
            </p>
          </div>
          <p class="text-xs text-neutral-400 shrink-0">
            {{ unclusteredTeam.members.length }} {{ teamsContent.unclustered.countLabel }}
          </p>
        </div>

        <ul class="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <li
            v-for="member in unclusteredTeam.members"
            :key="member.email"
            class="border border-neutral-200 bg-white p-4"
          >
            <div class="flex flex-wrap items-center gap-2">
              <p class="text-sm font-medium text-neutral-950">{{ member.name }}</p>
              <span
                v-if="member.tag === 'unregistered'"
                class="inline-flex items-center px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-red-600 text-white"
              >
                {{ member.tag }}
              </span>
            </div>
            <a
              :href="`mailto:${member.email}`"
              class="mt-1 block text-sm text-violet-700 hover:underline underline-offset-2 break-all"
            >
              {{ member.email }}
            </a>
          </li>
        </ul>
      </section>
    </section>
  </PublicLayout>
</template>
