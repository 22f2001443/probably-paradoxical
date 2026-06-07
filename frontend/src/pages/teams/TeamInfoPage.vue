<script setup>
import { ref, computed, onMounted } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { useAuthStore } from '../../stores/authStore.js'
import { apiGet } from '../../services/api.js'
import DashboardShell from '../../components/common/DashboardShell.vue'
import BaseCard from '../../components/common/BaseCard.vue'

const auth = useAuthStore()
const router = useRouter()
const user = computed(() => auth.user ?? {})

const tiles = computed(() => [
  { label: 'Team', value: user.value.teamName || '—' },
  { label: 'Team ID', value: user.value.teamId || '—' },
  { label: 'Your role', value: user.value.roleInTeam === 'leader' ? 'Team lead' : 'Member' },
  { label: 'Signed in as', value: user.value.email || '—' },
])

const members = ref([])
const loading = ref(true)
const error = ref('')

function initials(name) {
  if (!name) return '?'
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('')
}

async function load() {
  try {
    const data = await apiGet('/team/members', { token: auth.token })
    members.value = data.members || []
    error.value = ''
  } catch (e) {
    if (e?.status === 401) { auth.logout(); router.push('/login'); return }
    error.value = e?.message || 'Could not load team members.'
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <DashboardShell eyebrow="Participant" title="Team info">
    <RouterLink to="/participant" class="inline-flex items-center text-sm text-neutral-500 hover:text-neutral-950 mb-6">
      ← Back to dashboard
    </RouterLink>

    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
      <BaseCard v-for="tile in tiles" :key="tile.label">
        <p class="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-1">{{ tile.label }}</p>
        <p class="text-lg font-bold text-neutral-950 break-words">{{ tile.value }}</p>
      </BaseCard>
    </div>

    <h2 class="text-lg font-bold text-neutral-950 mb-3">Members</h2>

    <p v-if="loading" class="text-sm text-neutral-500">Loading members…</p>
    <p v-else-if="error" class="text-sm text-red-600">{{ error }}</p>
    <p v-else-if="members.length === 0" class="text-sm text-neutral-500">No members found.</p>

    <div v-else class="grid gap-3 sm:grid-cols-2">
      <div
        v-for="member in members"
        :key="member.email"
        class="flex items-center gap-3 border border-neutral-200 bg-white p-4"
      >
        <span class="flex-shrink-0 w-10 h-10 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center text-sm font-bold">
          {{ initials(member.name) }}
        </span>
        <div class="min-w-0">
          <div class="flex flex-wrap items-center gap-2">
            <p class="font-semibold text-neutral-950 truncate">{{ member.name }}</p>
            <span
              v-if="member.isLead"
              class="text-[10px] font-semibold uppercase tracking-widest bg-violet-600 text-white px-1.5 py-0.5"
            >
              Lead
            </span>
            <span
              v-else-if="member.tag"
              class="text-[10px] font-semibold uppercase tracking-widest bg-neutral-200 text-neutral-600 px-1.5 py-0.5"
            >
              {{ member.tag }}
            </span>
          </div>
          <p class="text-sm text-neutral-500 truncate">{{ member.email }}</p>
        </div>
      </div>
    </div>
  </DashboardShell>
</template>
