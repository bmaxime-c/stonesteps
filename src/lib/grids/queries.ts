import 'server-only'

import type { Exercise, TimerMode } from '@/lib/database.types'
import { createClient } from '@/lib/supabase/server'

export interface GridSummary {
  id: string
  name: string
  description: string | null
  isActive: boolean
  isPublic: boolean
  levelCount: number
}

export interface EditorExercise {
  id: string
  exerciseId: string
  exerciseName: string
  position: number
  sets: number
  reps: number | null
  timerMode: TimerMode
  timerSeconds: number | null
}

export interface EditorLevel {
  id: string
  position: number
  name: string | null
  exercises: EditorExercise[]
}

export interface EditorGrid {
  id: string
  name: string
  description: string | null
  isActive: boolean
  isPublic: boolean
  ownerId: string
  levels: EditorLevel[]
}

export async function listGrids(): Promise<GridSummary[]> {
  const supabase = await createClient()

  // La RLS restreint deja aux grilles lisibles ; on filtre en plus sur le
  // proprietaire pour que le tableau de bord ne montre que les siennes.
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('grids')
    .select('id, name, description, is_active, is_public, levels(count)')
    .eq('owner_id', user.id)
    .order('is_active', { ascending: false })
    .order('created_at', { ascending: true })

  if (error) throw error

  return (data ?? []).map((row) => ({
    id: row.id as string,
    name: row.name as string,
    description: row.description as string | null,
    isActive: row.is_active as boolean,
    isPublic: row.is_public as boolean,
    levelCount: (row.levels as { count: number }[] | null)?.[0]?.count ?? 0,
  }))
}

export async function getGrid(gridId: string): Promise<EditorGrid | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('grids')
    .select(
      `id, name, description, is_active, is_public, owner_id,
       levels (
         id, position, name,
         level_exercises (
           id, position, sets, reps, timer_mode, timer_seconds,
           exercises ( id, name )
         )
       )`,
    )
    .eq('id', gridId)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  type RawExercise = {
    id: string
    position: number
    sets: number
    reps: number | null
    timer_mode: TimerMode
    timer_seconds: number | null
    // Sans types generes, supabase-js infere une relation imbriquee comme un
    // tableau. A l'execution, une cle etrangere vers-un renvoie un objet. On
    // accepte les deux formes et on normalise.
    exercises: { id: string; name: string } | { id: string; name: string }[] | null
  }
  type RawLevel = {
    id: string
    position: number
    name: string | null
    level_exercises: RawExercise[] | null
  }

  const levels = ((data.levels as unknown as RawLevel[] | null) ?? [])
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
            exerciseId: exercise?.id ?? '',
            exerciseName: exercise?.name ?? 'Exercice supprime',
            position: row.position,
            sets: row.sets,
            reps: row.reps,
            timerMode: row.timer_mode,
            timerSeconds: row.timer_seconds,
          }
        }),
    }))

  return {
    id: data.id as string,
    name: data.name as string,
    description: data.description as string | null,
    isActive: data.is_active as boolean,
    isPublic: data.is_public as boolean,
    ownerId: data.owner_id as string,
    levels,
  }
}

/** Identifiants des membres avec qui une grille est explicitement partagee. */
export async function listGridShares(gridId: string): Promise<string[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('grid_shares')
    .select('shared_with')
    .eq('grid_id', gridId)

  if (error) throw error
  return (data ?? []).map((row) => row.shared_with as string)
}

/** Catalogue integre plus les exercices personnels, tries par nom. */
export async function listExercises(): Promise<Exercise[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('exercises')
    .select('id, owner_id, name, category, is_builtin, created_at')
    .order('name', { ascending: true })

  if (error) throw error
  return (data ?? []) as Exercise[]
}
