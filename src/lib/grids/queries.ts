import 'server-only'

import { createClient } from '@/lib/supabase/server'

import type { Grid, GridVersion, GridVersionStatus } from './model'

/**
 * Selection d'une grille, de ses versions et de tout leur arbre.
 *
 * PostgREST rend les relations imbriquees : inutile de faire cinq allers-
 * retours pour reconstituer grille, versions, niveaux, exercices et series. La
 * RLS fait le reste — une grille qui n'est pas la sienne ne remonte pas.
 *
 * Toutes les versions remontent, pas seulement la derniere : l'ecran de
 * gestion a besoin de savoir qu'un brouillon existe, et la publication a
 * besoin de comparer le brouillon a la version en place.
 */
const VERSION_SELECT = `
  id, version, status, name, accent_color, rest_seconds, carried_levels,
  levels (
    id, position,
    level_exercises (
      id, exercise_id, position,
      exercises ( name ),
      level_sets ( id, position, target_reps, timer_mode, timer_seconds )
    )
  )
`

const GRID_SELECT = `id, created_at, grid_versions ( ${VERSION_SELECT} )`

type VersionRow = {
  id: string
  version: number
  status: GridVersionStatus
  name: string
  accent_color: string
  rest_seconds: number
  carried_levels: number
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

type GridRow = {
  id: string
  created_at: string
  grid_versions: VersionRow[]
}

/** Passe des colonnes en snake_case aux formes du domaine, tout trie. */
function toVersion(row: VersionRow): GridVersion {
  return {
    id: row.id,
    version: row.version,
    status: row.status,
    name: row.name,
    accentColor: row.accent_color,
    restSeconds: row.rest_seconds,
    carriedLevels: row.carried_levels,
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

function toGrid(row: GridRow): Grid {
  const versions = row.grid_versions.map(toVersion)

  return {
    id: row.id,
    // La derniere publiee, pas la derniere creee : republier ne doit pas
    // dependre de l'ordre de retour de PostgREST.
    published:
      versions
        .filter((version) => version.status === 'published')
        .sort((a, b) => b.version - a.version)[0] ?? null,
    draft: versions.find((version) => version.status === 'draft') ?? null,
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
 * Toutes les grilles de l'utilisateur, versions comprises.
 *
 * L'accueil n'en garde que celles qui ont une version publiee ; l'ecran de
 * gestion les montre toutes. Le filtre appartient a l'ecran, pas a la requete.
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
