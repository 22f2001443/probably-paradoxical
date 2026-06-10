import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/authStore.js'
import { fetchTeamRounds, roundGate, isSubmitted } from '../services/rounds.js'

/**
 * Loads the team's live round pipeline and exposes the gate for one round.
 *
 * Fails open: if the status can't be loaded (network/server error), `locked`
 * stays false so a transient failure never blocks a team from submitting during
 * their window. A 401 logs the team out, matching the other team pages.
 */
export function useRoundGate(roundKey) {
  const auth = useAuthStore()
  const router = useRouter()

  const loading = ref(true)
  const round = ref(null)
  const submission = ref(null)

  const gate = computed(() => roundGate(round.value))
  // Only lock when we positively know the round exists and isn't open.
  const locked = computed(() => !loading.value && !!round.value && !gate.value.open)
  const submitted = computed(() => isSubmitted(submission.value))

  onMounted(async () => {
    try {
      const { byKey, submissions } = await fetchTeamRounds(auth.token)
      round.value = byKey[roundKey] ?? null
      submission.value = submissions[roundKey] ?? null
    } catch (e) {
      if (e?.status === 401) {
        auth.logout()
        router.push('/login')
        return
      }
      round.value = null // fail open
    } finally {
      loading.value = false
    }
  })

  return { loading, round, gate, locked, submission, submitted }
}
