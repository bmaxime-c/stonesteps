import 'server-only'

import { createClient } from '@/lib/supabase/server'

import type { Grid } from './model'

/**
 * Selection d'une grille et de tout son arbre, en une requete.
 *
 * PostgREST rend les relations imbriquees : inutile de faire quatre allers-
 * retours pour reconstituer grille, niveaux, exercices et series. La RLS fait
 * le reste — inutile de filtrer sur le proprietaire ici, une grille qui n'est
 * pas la sienne ne remonte simplement pas.
 */
const GRID_SELECT = `
  id, name, accent_color, rest_seconds,
  levels (
    id, position,
    level_exercises (
      id, exercise_id, position,
      exercises ( name ),
      level_sets ( id, position, target_reps, timer_mode, timer_seconds )
    )
  )
`

type GridRow = {
  id: string
  name: string
  accent_color: string
  rest_seconds: number
  levels: {
    id: string
    position: number
    level_exercises: {
      id: string
      exercise_id: string
      position: number
      exercises: { name: string } | null
      level_sets: {
        id: string
        position: number
        target_reps: number
        timer_mode: 'none' | 'minimal' | 'strict'
        timer_seconds: number | null
      }[]
    }[]
  }[]
}

/** Passe des colonnes en snake_case aux formes du domaine, tout trie. */
function toGrid(row: GridRow): Grid {
  return {
    id: row.id,
    name: row.name,
    accentColor: row.accent_color,
    restSeconds: row.rest_seconds,
    levels: [...row.levels]
      .sort((a, b) => a.position - b.position)
      .map((level) => ({
        id: level.id,
        position: level.position,
        exercises: [...level.level_exercises]
          .sort((a, b) => a.position - b.position)
          .map((exercise) => ({
            id: exercise.id,
            exerciseId: exercise.exercise_id,
            // Le nom vient du catalogue ; il n'est recopie en snapshot que
            // dans l'historique, pas dans la definition.
            exerciseName: exercise.exercises?.name ?? 'Exercice',
            position: exercise.position,
            sets: [...exercise.level_sets]
              .sort((a, b) => a.position - b.position)
              .map((set) => ({
                id: set.id,
                position: set.position,
                targetReps: set.target_reps,
                timerMode: set.timer_mode,
                timerSeconds: set.timer_seconds,
              })),
          })),
      })),
  }
}

export async function loadGrid(gridId: string): Promise<Grid | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('grids')
    .select(GRID_SELECT)
    .eq('id', gridId)
    .maybeSingle()

  if (error || !data) return null
  return toGrid(data as unknown as GridRow)
}

/**
 * Toutes les grilles de l'utilisateur, arbre compris.
 *
 * L'accueil a besoin du contenu du niveau en cours de chaque grille — nombre
 * d'exercices et de series — donc de l'arbre entier. A l'echelle d'un
 * utilisateur qui suit quelques grilles, une requete suffit ; la decouper
 * reviendrait a multiplier les allers-retours pour rien.
 */
export async function loadGrids(): Promise<Grid[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('grids')
    .select(GRID_SELECT)
    .order('created_at', { ascending: true })

  if (error || !data) return []
  return (data as unknown as GridRow[]).map(toGrid)
}

export type CatalogExercise = {
  id: string
  name: string
  muscleGroup: 'push' | 'pull' | 'legs' | 'core'
}

/**
 * Catalogue d'exercices : les integres, plus ceux de l'utilisateur.
 *
 * La RLS decide ce qui remonte — lecture ouverte quand `owner_id` est null,
 * ses propres exercices sinon.
 */
export async function loadExerciseCatalog(): Promise<CatalogExercise[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('exercises')
    .select('id, name, muscle_group')
    .order('created_at', { ascending: true })

  if (error || !data) return []

  return data.map((row) => ({
    id: row.id,
    name: row.name,
    muscleGroup: row.muscle_group,
  }))
}
