import 'server-only'

import type { SessionRecord, SetStatus, SetUnit } from '@/lib/session/model'
import { createClient } from '@/lib/supabase/server'

/**
 * Historique consolide, seances et series comprises.
 *
 * Seules les seances dont `completed_at` est renseigne remontent : une seance
 * dont les series n'ont pas fini de s'ecrire fausserait chaque agregation.
 *
 * Les colonnes lues sont les snapshots, pas les jointures : une grille
 * supprimee garde son historique, et c'est bien ce qu'on veut voir ici.
 */
const SESSION_SELECT = `
  id, grid_id, grid_name, level_number, started_at, validated,
  session_sets (
    level_set_id, set_index, exercise_name, set_label,
    unit, target_value, actual_value, status
  )
`

type SessionRow = {
  id: string
  grid_id: string | null
  grid_name: string
  level_number: number
  started_at: string
  validated: boolean
  session_sets: {
    level_set_id: string | null
    set_index: number
    exercise_name: string
    set_label: string
    unit: string
    target_value: number
    actual_value: number
    status: SetStatus
  }[]
}

export async function loadSessions(): Promise<SessionRecord[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('sessions')
    .select(SESSION_SELECT)
    .not('completed_at', 'is', null)
    .order('started_at', { ascending: true })

  if (error || !data) return []

  return (data as unknown as SessionRow[]).map((row) => ({
    id: row.id,
    gridId: row.grid_id,
    gridName: row.grid_name,
    levelNumber: row.level_number,
    startedAt: row.started_at,
    validated: row.validated,
    results: [...row.session_sets]
      .sort((a, b) => a.set_index - b.set_index)
      .map((set) => ({
        levelSetId: set.level_set_id,
        setIndex: set.set_index,
        exerciseName: set.exercise_name,
        setLabel: set.set_label,
        unit: set.unit as SetUnit,
        targetValue: set.target_value,
        actualValue: set.actual_value,
        status: set.status,
      })),
  }))
}
