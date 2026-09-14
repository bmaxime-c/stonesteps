import type { GridIssue } from '@/lib/grids/validation'
import type { TimerMode } from '@/lib/grids/model'

/**
 * Entrees et sorties des actions de grille.
 *
 * Hors de actions.ts : un module « use server » ne peut exporter que des
 * fonctions asynchrones.
 */

export type SaveSetInput = {
  targetReps: number
  timerMode: TimerMode
  timerSeconds: number | null
}

export type SaveExerciseInput = {
  exerciseId: string
  exerciseName: string
  sets: SaveSetInput[]
}

export type SaveLevelInput = { exercises: SaveExerciseInput[] }

export type SaveGridInput = {
  /** Null pour une creation. */
  gridId: string | null
  name: string
  accentColor: string
  restSeconds: number
  levels: SaveLevelInput[]
}

export type SaveGridResult =
  | { gridId: string; error: null; issues: [] }
  | { gridId: null; error: string; issues: GridIssue[] }

export type DeleteGridResult = { error: string | null }
