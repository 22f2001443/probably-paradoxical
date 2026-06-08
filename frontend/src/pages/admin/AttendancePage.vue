<script setup>
import { ref, computed, onMounted } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { useToast } from 'vue-toastification'
import { useAuthStore } from '../../stores/authStore.js'
import { apiGet, apiPost } from '../../services/api.js'
import DashboardShell from '../../components/common/DashboardShell.vue'
import BaseCard from '../../components/common/BaseCard.vue'
import BaseButton from '../../components/common/BaseButton.vue'

const auth = useAuthStore()
const router = useRouter()
const toast = useToast()

const days = ref([])
const teams = ref([])
const present = ref({}) // `${teamId}|${day}` -> true
const loading = ref(true)
const error = ref('')
const busy = ref(false)
const query = ref('')

function key(teamId, day) { return `${teamId}|${day}` }
function isPresent(teamId, day) { return present.value[key(teamId, day)] === true }

const filteredTeams = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return teams.value
  return teams.value.filter((t) => t.teamName.toLowerCase().includes(q) || t.teamId.toLowerCase().includes(q))
})

function presentCount(day) {
  return teams.value.reduce((n, t) => n + (isPresent(t.teamId, day) ? 1 : 0), 0)
}

async function load() {
  try {
    const data = await apiGet('/admin/attendance', { token: auth.token })
    days.value = data.days || []
    teams.value = data.teams || []
    const map = {}
    for (const r of data.attendance || []) map[key(r.teamId, r.day)] = true
    present.value = map
    error.value = ''
  } catch (e) {
    if (e?.status === 401) { auth.logout(); router.push('/login'); return }
    error.value = e?.message || 'Failed to load attendance.'
  } finally {
    loading.value = false
  }
}

async function toggle(teamId, day) {
  const next = !isPresent(teamId, day)
  present.value = { ...present.value, [key(teamId, day)]: next } // optimistic
  try {
    await apiPost('/admin/attendance', { teamId, day, present: next }, { token: auth.token })
  } catch (e) {
    present.value = { ...present.value, [key(teamId, day)]: !next } // revert
    toast.error(e?.message || 'Could not update attendance.')
  }
}

async function markAll(day, value) {
  busy.value = true
  try {
    await apiPost('/admin/attendance/bulk', { day, present: value }, { token: auth.token })
    await load()
    toast.success(`${days.value.find((d) => d.key === day)?.label || day}: marked all ${value ? 'present' : 'absent'}.`)
  } catch (e) {
    toast.error(e?.message || 'Bulk update failed.')
  } finally {
    busy.value = false
  }
}

onMounted(load)
</script>

<template>
  <DashboardShell eyebrow="Organiser" title="Attendance">
    <RouterLink to="/admin" class="inline-flex items-center text-sm text-neutral-500 hover:text-neutral-950 mb-6">
      ← Back to dashboard
    </RouterLink>

    <p v-if="loading" class="text-sm text-neutral-500">Loading…</p>
    <p v-else-if="error" class="text-sm text-red-600">{{ error }}</p>

    <template v-else>
      <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
        <input
          v-model="query"
          type="text"
          placeholder="Search team…"
          class="w-64 max-w-full border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-600"
        />
        <p class="text-xs text-neutral-500">{{ teams.length }} teams · per-day attendance</p>
      </div>

      <BaseCard class="overflow-x-auto">
        <table class="w-full text-sm border-collapse">
          <thead>
            <tr class="text-left border-b border-neutral-200">
              <th class="py-2 pr-4 font-semibold text-neutral-600">Team</th>
              <th v-for="d in days" :key="d.key" class="py-2 px-3 font-semibold text-neutral-600 text-center whitespace-nowrap">
                <div>{{ d.label }}</div>
                <div class="text-[11px] font-normal text-neutral-400">{{ d.date }}</div>
                <div class="mt-1 text-[11px] font-bold text-violet-700">{{ presentCount(d.key) }}/{{ teams.length }}</div>
                <div class="mt-1 flex justify-center gap-1">
                  <button type="button" class="text-[10px] text-emerald-700 hover:underline disabled:opacity-40" :disabled="busy" @click="markAll(d.key, true)">all</button>
                  <span class="text-neutral-300">·</span>
                  <button type="button" class="text-[10px] text-neutral-500 hover:underline disabled:opacity-40" :disabled="busy" @click="markAll(d.key, false)">none</button>
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="t in filteredTeams" :key="t.teamId" class="border-b border-neutral-100 last:border-0">
              <td class="py-2 pr-4">
                <div class="flex items-center gap-2">
                  <span class="text-xs font-bold text-neutral-400">{{ t.teamId }}</span>
                  <span class="font-medium text-neutral-950">{{ t.teamName }}</span>
                  <span v-if="t.status === 'eliminated'" class="text-[10px] font-bold uppercase tracking-wider text-red-600">out</span>
                </div>
              </td>
              <td v-for="d in days" :key="d.key" class="py-2 px-3 text-center">
                <button
                  type="button"
                  class="w-9 h-9 border text-sm font-bold transition-colors"
                  :class="isPresent(t.teamId, d.key)
                    ? 'bg-emerald-600 border-emerald-600 text-white'
                    : 'bg-white border-neutral-300 text-neutral-300 hover:border-neutral-500'"
                  :aria-pressed="isPresent(t.teamId, d.key)"
                  :title="`${t.teamName} — ${d.label}`"
                  @click="toggle(t.teamId, d.key)"
                >
                  {{ isPresent(t.teamId, d.key) ? 'P' : 'A' }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
        <p v-if="!filteredTeams.length" class="text-sm text-neutral-500 py-4">No teams match “{{ query }}”.</p>
      </BaseCard>

      <p class="mt-3 text-xs text-neutral-400">P = present · A = absent. Changes save automatically.</p>
    </template>
  </DashboardShell>
</template>
