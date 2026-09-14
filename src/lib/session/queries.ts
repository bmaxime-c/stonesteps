import 'server-only'

import { createClient } from '@/lib/supabase/server'

import type { LevelOutcome } from './model'

/**
 * Verdicts des seances d'une grille, pour en deduire le niveau en cours.
 *
 * Seules les seances consolidees comptent : `completed_at` est renseigne en
 * dernier, une fois les series ecrites. Une seance interrompue au milieu de
 * l'ecriture n'existe donc pour personne.
 */
export async function loadLevelOutcomes(gridId: string): Promise<LevelOutcome[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('sessions')
    .select('level_id, level_number, validated, started_at')
    .eq('grid_id', gridId)
    .not('completed_at', 'is', null)
    .order('started_at', { ascending: true })

  if (error || !data) return []

  return data.map((row) => ({
    levelId: row.level_id,
    levelNumber: row.level_number,
    validated: row.validated,
    startedAt: row.started_at,
  }))
}
