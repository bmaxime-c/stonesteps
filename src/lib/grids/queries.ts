import 'server-only'

import { logSupabaseError } from '@/lib/supabase/log'
import { createClient } from '@/lib/supabase/server'

import type { Grid, GridVersion, GridVersionStatus } from './model'

/**
 * Selection d'une grille, de ses versions et de tout leur arbre.
 *
 * PostgREST rend les relations imbriquees : inutile de faire cinq allers-
 * retours pour reconstituer grille, versions, niveaux, exercices et series.
 *
 * La RLS fait le tri : une grille qui n'est ni la sienne, ni publique, ni
 * suivie ne remonte pas, et un brouillon ne sort jamais de chez son auteur.
 * `grid_followers` rend les suivis de l'appelant, plus tous ceux des grilles
 * qu'il a creees — c'est ainsi qu'un createur sait combien de monde le suit.
 *
 * Toutes les versions publiees remontent, pas seulement la derniere : le
 * report de progression se reconstruit de proche en proche.
 */
const VERSION_SELECT = `
  id, version, status, name, accent_color, rest_seconds, unchanged_prefix,
  levels (
    id, position,
    level_exercises (
      id, exercise_id, position,
      exercises ( name ),
      level_sets ( id, position, target_reps, timer_mode, timer_seconds )
    )
  )
`

/**
 * La relation vers `profiles` est nommee par sa cle etrangere.
 *
 * `grid_followers` reference a la fois `grids` et `profiles`, ce qui ouvre un
 * second chemin entre les deux tables. Sans le nom de la contrainte, PostgREST
 * ne sait pas lequel prendre et rejette la requete entiere.
 */
const GRID_SELECT = `
  id, owner_id, is_public, deleted_at, created_at,
  profiles!grids_owner_id_fkey ( display_name ),
  grid_followers ( user_id, frozen_at_version ),
  grid_versions ( ${VERSION_SELECT} )
`

type VersionRow = {
  id: string
  version: number
  status: GridVersionStatus
  name: string
  accent_color: string
  rest_seconds: number
  unchanged_prefix: number
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
  owner_id: string
  is_public: boolean
  deleted_at: string | null
  created_at: string
  profiles: { display_name: string | null } | null
  grid_followers: { user_id: string; frozen_at_version: number | null }[]
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
    unchangedPrefix: row.unchanged_prefix,
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

function toGrid(row: GridRow, userId: string | null): Grid {
  const versions = row.grid_versions.map(toVersion)
  // Le createur voit tous les suivis de sa grille, les autres seulement le
  // leur : on cherche donc le sien nommement.
  const follow = row.grid_followers.find((row) => row.user_id === userId)

  return {
    id: row.id,
    ownerId: row.owner_id,
    ownerName: row.profiles?.display_name ?? null,
    isPublic: row.is_public,
    deletedAt: row.deleted_at,
    owned: userId !== null && row.owner_id === userId,
    publishedVersions: versions
      .filter((version) => version.status === 'published')
      .sort((a, b) => a.version - b.version),
    draft: versions.find((version) => version.status === 'draft') ?? null,
    follow: follow ? { frozenAtVersion: follow.frozen_at_version } : null,
    // N'a de sens que sur une grille dont on est le createur : ailleurs, la
    // RLS ne laisse voir que son propre suivi.
    followerCount: row.grid_followers.length,
  }
}

async function currentUserId(): Promise<string | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user?.id ?? null
}

export async function loadGrid(gridId: string): Promise<Grid | null> {
  const supabase = await createClient()
  const [userId, { data, error }] = await Promise.all([
    currentUserId(),
    supabase.from('grids').select(GRID_SELECT).eq('id', gridId).maybeSingle(),
  ])

  if (error || !data) {
    logSupabaseError('loadGrid', error)
    return null
  }
  return toGrid(data as unknown as GridRow, userId)
}

/**
 * Grilles que l'utilisateur a chez lui : les siennes, et celles qu'il suit.
 *
 * La RLS laisse aussi passer les grilles publiques des autres ; elles ne sont
 * pas « chez lui » tant qu'il ne les a pas adoptees, et c'est l'ecran
 * « Decouvrir » qui les montre.
 */
export async function loadMyGrids(): Promise<Grid[]> {
  const supabase = await createClient()
  const [userId, { data, error }] = await Promise.all([
    currentUserId(),
    supabase.from('grids').select(GRID_SELECT).order('created_at', { ascending: true }),
  ])

  if (error || !data) {
    logSupabaseError('loadMyGrids', error)
    return []
  }

  return (
    (data as unknown as GridRow[])
      .map((row) => toGrid(row, userId))
      .filter((grid) => grid.owned || grid.follow !== null)
      // Une grille supprimee par son createur ne reste que chez ceux qui la
      // suivaient : elle n'a plus rien a faire chez lui.
      .filter((grid) => !(grid.owned && grid.deletedAt !== null))
  )
}

/**
 * Grilles publiques des autres, pas encore adoptees.
 *
 * C'est le catalogue de l'ecran « Decouvrir ». Une grille deja suivie n'y
 * figure plus : elle est chez soi.
 */
export async function loadPublicGrids(): Promise<Grid[]> {
  const supabase = await createClient()
  const [userId, { data, error }] = await Promise.all([
    currentUserId(),
    supabase
      .from('grids')
      .select(GRID_SELECT)
      .eq('is_public', true)
      .is('deleted_at', null)
      .order('created_at', { ascending: false }),
  ])

  if (error || !data) {
    logSupabaseError('loadPublicGrids', error)
    return []
  }

  return (data as unknown as GridRow[])
    .map((row) => toGrid(row, userId))
    .filter((grid) => !grid.owned && grid.follow === null)
    .filter((grid) => grid.publishedVersions.length > 0)
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
