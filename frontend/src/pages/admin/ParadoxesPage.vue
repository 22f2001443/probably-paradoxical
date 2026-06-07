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

const list = ref([])
const loading = ref(true)
const error = ref('')
const saving = ref(false)

// Form state — editingId === null means "create".
const editingId = ref(null)
const form = ref({ name: '', description: '', example: '' })
const isEditing = computed(() => editingId.value !== null)

const inputClass =
  'w-full border border-neutral-300 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-violet-600 focus:border-transparent transition-shadow'

async function load() {
  try {
    const res = await apiGet('/admin/paradoxes', { token: auth.token })
    list.value = res.paradoxes || []
    error.value = ''
  } catch (e) {
    if (e?.status === 401) { auth.logout(); router.push('/login'); return }
    error.value = e?.message || 'Failed to load paradoxes.'
  } finally {
    loading.value = false
  }
}

function resetForm() {
  editingId.value = null
  form.value = { name: '', description: '', example: '' }
}

function startEdit(p) {
  editingId.value = p.id
  form.value = { name: p.name, description: p.description, example: p.example || '' }
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

async function save() {
  if (!form.value.name.trim() || !form.value.description.trim()) {
    toast.error('Name and description are required.')
    return
  }
  saving.value = true
  try {
    if (isEditing.value) {
      await apiPost('/admin/paradoxes/update', { id: editingId.value, ...form.value }, { token: auth.token })
      toast.success('Paradox updated.')
    } else {
      await apiPost('/admin/paradoxes', { ...form.value }, { token: auth.token })
      toast.success('Paradox added.')
    }
    resetForm()
    await load()
  } catch (e) {
    toast.error(e?.message || 'Could not save.')
  } finally {
    saving.value = false
  }
}

async function togglePublish(p) {
  const state = p.state === 'published' ? 'draft' : 'published'
  try {
    await apiPost('/admin/paradoxes/update', { id: p.id, state }, { token: auth.token })
    toast.success(state === 'published' ? 'Published.' : 'Unpublished.')
    await load()
  } catch (e) {
    toast.error(e?.message || 'Could not update.')
  }
}

async function remove(p) {
  if (!window.confirm(`Delete paradox "${p.name}"? This cannot be undone.`)) return
  try {
    await apiPost('/admin/paradoxes/delete', { id: p.id }, { token: auth.token })
    toast.success('Paradox deleted.')
    if (editingId.value === p.id) resetForm()
    await load()
  } catch (e) {
    toast.error(e?.message || 'Could not delete.')
  }
}

onMounted(load)
</script>

<template>
  <DashboardShell eyebrow="Organiser" title="Paradoxes">
    <RouterLink to="/admin" class="inline-flex items-center text-sm text-neutral-500 hover:text-neutral-950 mb-6">
      ← Back to dashboard
    </RouterLink>

    <!-- Add / edit form -->
    <BaseCard class="mb-8">
      <h2 class="text-lg font-bold text-neutral-950 mb-4">{{ isEditing ? 'Edit paradox' : 'Add a paradox' }}</h2>
      <form class="space-y-4" novalidate @submit.prevent="save">
        <div>
          <label for="px-name" class="block text-xs font-semibold uppercase tracking-widest text-neutral-600 mb-2">Name</label>
          <input id="px-name" v-model="form.name" type="text" placeholder="e.g. The Unexpected Hanging" :class="inputClass" />
        </div>
        <div>
          <label for="px-desc" class="block text-xs font-semibold uppercase tracking-widest text-neutral-600 mb-2">Description</label>
          <textarea id="px-desc" v-model="form.description" rows="3" placeholder="What is the paradox?" :class="inputClass" />
        </div>
        <div>
          <label for="px-ex" class="block text-xs font-semibold uppercase tracking-widest text-neutral-600 mb-2">Example</label>
          <textarea id="px-ex" v-model="form.example" rows="3" placeholder="A concrete illustration (optional)" :class="inputClass" />
        </div>
        <div class="flex gap-3 pt-1">
          <BaseButton variant="primary" :disabled="saving">{{ saving ? 'Saving…' : (isEditing ? 'Update paradox' : 'Add paradox') }}</BaseButton>
          <BaseButton v-if="isEditing" variant="ghost" :disabled="saving" @click="resetForm">Cancel</BaseButton>
        </div>
      </form>
    </BaseCard>

    <!-- List -->
    <div class="flex items-center justify-between mb-3">
      <h2 class="text-lg font-bold text-neutral-950">All paradoxes <span class="text-neutral-400 font-normal">({{ list.length }})</span></h2>
    </div>

    <p v-if="loading" class="text-sm text-neutral-500">Loading…</p>
    <p v-else-if="error" class="text-sm text-red-600">{{ error }}</p>
    <p v-else-if="!list.length" class="text-sm text-neutral-500">No paradoxes yet. Add your first one above.</p>

    <div v-else class="space-y-4">
      <BaseCard v-for="p in list" :key="p.id">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="flex items-center gap-2">
            <span class="text-xs font-bold text-neutral-400">{{ p.paradoxCode }}</span>
            <h3 class="font-bold text-neutral-950">{{ p.name }}</h3>
            <span
              class="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5"
              :class="p.state === 'published' ? 'bg-emerald-600 text-white' : 'border border-neutral-300 text-neutral-500'"
            >
              {{ p.state }}
            </span>
          </div>
          <div class="flex items-center gap-3 text-sm">
            <button type="button" class="font-semibold text-neutral-700 hover:text-neutral-950" @click="startEdit(p)">Edit</button>
            <button type="button" class="font-semibold text-violet-700 hover:text-violet-900" @click="togglePublish(p)">
              {{ p.state === 'published' ? 'Unpublish' : 'Publish' }}
            </button>
            <button type="button" class="font-semibold text-red-600 hover:text-red-800" @click="remove(p)">Delete</button>
          </div>
        </div>
        <p class="mt-2 text-sm text-neutral-700 whitespace-pre-line">{{ p.description }}</p>
        <p v-if="p.example" class="mt-2 text-sm text-neutral-500 whitespace-pre-line border-l-2 border-neutral-200 pl-3">
          <span class="font-semibold text-neutral-600">Example: </span>{{ p.example }}
        </p>
      </BaseCard>
    </div>
  </DashboardShell>
</template>
