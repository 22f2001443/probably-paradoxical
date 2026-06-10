// Live round/stage status for participants. Mirrors the backend round pipeline
// (db/collections.ts ROUND_KEYS) and drives the "visible but locked" gating on
// the participant dashboard and submission pages.
import { apiGet } from './api.js'

/** Round keys, mirroring the backend. */
export const ROUND_KEYS = {
  stage0: 'stage0_release',
  stage1: 'stage1_submission',
  stage2: 'stage2_data_collection',
  stage3: 'stage3_analysis',
  stage4: 'stage4_presentation',
}

/** Fetch the team-visible round pipeline (states, current round, submissions). */
export async function fetchTeamRounds(token) {
  const res = await apiGet('/team/overview', { token })
  const rounds = Array.isArray(res.rounds) ? res.rounds : []
  const byKey = {}
  for (const round of rounds) byKey[round.roundKey] = round
  return {
    currentRoundKey: res.currentRoundKey ?? null,
    rounds,
    byKey,
    submissions: res.submissions && typeof res.submissions === 'object' ? res.submissions : {},
  }
}

/** Whether a submission record counts as submitted. */
export function isSubmitted(submission) {
  return submission?.status === 'submitted'
}

/** Format a submittedAt timestamp for display, or '' if missing/invalid. */
export function formatSubmittedAt(submittedAt) {
  if (!submittedAt) return ''
  const date = new Date(submittedAt)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

/**
 * Map a round to its submission gate. Submissions are accepted only while the
 * round is `open`; every other state is locked (visible but disabled).
 * `status` maps onto StatusBadge ('completed' | 'active' | 'upcoming').
 */
export function roundGate(round) {
  switch (round?.state) {
    case 'open':
      return { open: true, status: 'active', label: 'Open', note: '' }
    case 'closed':
    case 'stale':
      return {
        open: false,
        status: 'completed',
        label: 'Closed',
        note: 'This round has closed — submissions are no longer accepted.',
      }
    case 'results_published':
      return {
        open: false,
        status: 'completed',
        label: 'Results out',
        note: 'This round is complete and results have been published.',
      }
    default: // 'upcoming' or unknown/missing
      return {
        open: false,
        status: 'upcoming',
        label: 'Not open yet',
        note: 'This round hasn’t opened yet. It will unlock when this stage begins.',
      }
  }
}
