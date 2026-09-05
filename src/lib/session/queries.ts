import 'server-only'

import { createClient } from '@/lib/supabase/server'

import type { PlannedLevel } from './progress'
import { resolveResumeLevel } from './progress'

export interface SessionStart {
  gridId: string
  gridName: string
  levels: PlannedLevel[]
  validatedLevelIds: string[]
  /** Niveau auquel reprendre, ou null si la grille est entierement validee. */
  resumeLevel: PlannedLevel | null
}

/**
 * Tout ce qu'il faut pour demarrer une seance : la grille active, son plan
 * complet, et les niveaux deja valides.
 *
 * Le plan entier est charge, pas seulement le niveau de reprise : il part
 * ensuite en IndexedDB, ce qui permet de continuer sans reseau — y compris
 * d'enchainer sur le niveau suivant.
 */
export async function loadActiveGridPlan(): Promise<SessionStart | null> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: grid, error } = await supabase
    .from('grids')
    .select(
      `id, name,
       levels (
         id, position, name,
         level_exercises (
           id, position, sets, reps, timer_mode, timer_seconds,
           exercises ( name )
         )
       )`,
    )
    .eq('owner_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  if (error) throw error
  if (!grid) return null

  type RawExercise = {
    id: string
    position: number
    sets: number
    reps: number | null
    timer_mode: PlannedLevel['exercises'][number]['timerMode']
    timer_seconds: number | null
    exercises: { name: string } | { name: string }[] | null
  }
  type RawLevel = {
    id: string
    position: number
    name: string | null
    level_exercises: RawExercise[] | null
  }

  const levels: PlannedLevel[] = ((grid.levels as unknown as RawLevel[] | null) ?? [])
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((level) => ({
      id: level.id,
      position: level.position,
      name: level.name,
      exercises: (level.level_exercises ?? [])
        .slice()
        .sort((a, b) => a.position - b.position)
        .map((row) => {
          const exercise = Array.isArray(row.exercises) ? row.exercises[0] : row.exercises
          return {
            id: row.id,
            exerciseName: exercise?.name ?? 'Exercice supprime',
            position: row.position,
            sets: row.sets,
            reps: row.reps,
            timerMode: row.timer_mode,
            timerSeconds: row.timer_seconds,
          }
        }),
    }))

  const { data: validated, error: validatedError } = await supabase
    .from('sessions')
    .select('level_id')
    .eq('user_id', user.id)
    .eq('grid_id', grid.id)
    .eq('validated', true)

  if (validatedError) throw validatedError

  const validatedLevelIds = [
    ...new Set((validated ?? []).map((row) => row.level_id as string)),
  ]

  return {
    gridId: grid.id as string,
    gridName: grid.name as string,
    levels,
    validatedLevelIds,
    resumeLevel: resolveResumeLevel(levels, new Set(validatedLevelIds)),
  }
}
