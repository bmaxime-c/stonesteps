import 'server-only'

import { createClient } from '@/lib/supabase/server'

import type { HistorySession } from './stats'

interface RawSetResult {
  level_exercise_id: string
  set_index: number
  success: boolean
  reps_done: number | null
  duration_seconds: number | null
  level_exercises:
    | { exercises: { name: string } | { name: string }[] | null }
    | { exercises: { name: string } | { name: string }[] | null }[]
    | null
}

interface RawSession {
  id: string
  grid_id: string
  level_id: string
  started_at: string
  ended_at: string | null
  validated: boolean
  grids: { name: string } | { name: string }[] | null
  levels:
    | { position: number; name: string | null }
    | { position: number; name: string | null }[]
    | null
  set_results: RawSetResult[] | null
}

/** supabase-js infere les relations imbriquees comme des tableaux ; a l'execution une cle vers-un renvoie un objet. */
function one<T>(value: T | T[] | null): T | null {
  if (value === null) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

function exerciseNameOf(row: RawSetResult): string {
  const levelExercise = one(row.level_exercises)
  const exercise = levelExercise ? one(levelExercise.exercises) : null
  return exercise?.name ?? 'Exercice supprime'
}

function toHistorySession(raw: RawSession): HistorySession {
  const results = raw.set_results ?? []
  const grid = one(raw.grids)
  const level = one(raw.levels)

  return {
    id: raw.id,
    gridId: raw.grid_id,
    gridName: grid?.name ?? 'Grille supprimee',
    levelId: raw.level_id,
    levelPosition: level?.position ?? 0,
    levelName: level?.name ?? null,
    startedAt: raw.started_at,
    endedAt: raw.ended_at,
    validated: raw.validated,
    totalSets: results.length,
    successfulSets: results.filter((r) => r.success).length,
    failures: results
      .filter((r) => !r.success)
      .map((r) => ({ exerciseName: exerciseNameOf(r), repsDone: r.reps_done })),
  }
}

const SESSION_SELECT = `
  id, grid_id, level_id, started_at, ended_at, validated,
  grids ( name ),
  levels ( position, name ),
  set_results (
    level_exercise_id, set_index, success, reps_done, duration_seconds,
    level_exercises ( exercises ( name ) )
  )
`

/**
 * Historique des seances du membre connecte, les plus recentes d'abord.
 *
 * `gridId` filtre sur une grille. La RLS restreint deja aux seances lisibles ;
 * le filtre sur `user_id` evite en plus de melanger les siennes a celles d'un
 * ami une fois la phase 5 en place.
 */
export async function listSessions(gridId?: string): Promise<HistorySession[]> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []

  let query = supabase
    .from('sessions')
    .select(SESSION_SELECT)
    .eq('user_id', user.id)
    .order('started_at', { ascending: false })

  if (gridId) query = query.eq('grid_id', gridId)

  const { data, error } = await query
  if (error) throw error

  return ((data as unknown as RawSession[] | null) ?? []).map(toHistorySession)
}

export interface SessionDetail extends HistorySession {
  results: {
    exerciseName: string
    setIndex: number
    success: boolean
    repsDone: number | null
    durationSeconds: number | null
  }[]
}

export async function getSession(sessionId: string): Promise<SessionDetail | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('sessions')
    .select(SESSION_SELECT)
    .eq('id', sessionId)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  const raw = data as unknown as RawSession
  const results = (raw.set_results ?? [])
    .slice()
    .sort((a, b) => a.set_index - b.set_index)
    .map((row) => ({
      exerciseName: exerciseNameOf(row),
      setIndex: row.set_index,
      success: row.success,
      repsDone: row.reps_done,
      durationSeconds: row.duration_seconds,
    }))

  return { ...toHistorySession(raw), results }
}

/** Grilles ayant au moins une seance, pour alimenter le filtre. */
export async function listSessionGrids(): Promise<{ id: string; name: string }[]> {
  const sessions = await listSessions()
  const byId = new Map<string, string>()
  for (const session of sessions) {
    byId.set(session.gridId, session.gridName)
  }
  return [...byId].map(([id, name]) => ({ id, name }))
}
