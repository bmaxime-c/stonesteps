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

/**
 * Verdicts de toutes les grilles a la fois, indexes par grille.
 *
 * L'accueil affiche le niveau en cours de chaque grille : une requete pour
 * l'ensemble plutot qu'une par carte.
 */
export async function loadAllLevelOutcomes(): Promise<Map<string, LevelOutcome[]>> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('sessions')
    .select('grid_id, level_id, level_number, validated, started_at')
    .not('completed_at', 'is', null)
    .order('started_at', { ascending: true })

  const byGrid = new Map<string, LevelOutcome[]>()
  if (error || !data) return byGrid

  for (const row of data) {
    // Une seance dont la grille a ete supprimee garde ses snapshots, mais ne
    // situe plus aucune progression.
    if (!row.grid_id) continue

    const list = byGrid.get(row.grid_id) ?? []
    list.push({
      levelId: row.level_id,
      levelNumber: row.level_number,
      validated: row.validated,
      startedAt: row.started_at,
    })
    byGrid.set(row.grid_id, list)
  }

  return byGrid
}
