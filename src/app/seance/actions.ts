'use server'

import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/server'

export interface SyncPayload {
  sessionId: string
  gridId: string
  levelId: string
  startedAt: string
  endedAt: string | null
  validated: boolean
  outcomes: {
    levelExerciseId: string
    setIndex: number
    success: boolean
    repsDone: number | null
    durationSeconds: number | null
  }[]
}

export interface SyncResult {
  ok: boolean
  error: string | null
}

/**
 * Pousse une seance locale vers le serveur.
 *
 * Entierement idempotente : l'identifiant de seance est genere par le client,
 * et `set_results` porte la cle naturelle
 * `(session_id, level_exercise_id, set_index)`. Rejouer la meme
 * synchronisation ne cree donc aucun doublon — ce qui est indispensable quand
 * le reseau coupe au mauvais moment et qu'on ne sait pas si l'ecriture est
 * passee.
 */
export async function syncSession(payload: SyncPayload): Promise<SyncResult> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Session expiree, reconnecte-toi.' }

  const { error: sessionError } = await supabase.from('sessions').upsert(
    {
      id: payload.sessionId,
      user_id: user.id,
      grid_id: payload.gridId,
      level_id: payload.levelId,
      started_at: payload.startedAt,
      ended_at: payload.endedAt,
      validated: payload.validated,
    },
    { onConflict: 'id' },
  )

  if (sessionError) return { ok: false, error: sessionError.message }

  if (payload.outcomes.length > 0) {
    const { error: resultsError } = await supabase.from('set_results').upsert(
      payload.outcomes.map((outcome) => ({
        session_id: payload.sessionId,
        level_exercise_id: outcome.levelExerciseId,
        set_index: outcome.setIndex,
        success: outcome.success,
        reps_done: outcome.repsDone,
        duration_seconds: outcome.durationSeconds,
      })),
      { onConflict: 'session_id,level_exercise_id,set_index' },
    )

    if (resultsError) return { ok: false, error: resultsError.message }
  }

  revalidatePath('/dashboard')
  revalidatePath('/seance')
  return { ok: true, error: null }
}
