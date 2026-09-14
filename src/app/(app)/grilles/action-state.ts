import type { TimerMode } from '@/lib/grids/model'
import type { GridIssue } from '@/lib/grids/validation'

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

/** Ce que le constructeur envoie : toujours un brouillon, jamais du publie. */
export type SaveDraftInput = {
  /** Null pour une grille qui n'existe pas encore. */
  gridId: string | null
  name: string
  accentColor: string
  restSeconds: number
  levels: SaveLevelInput[]
}

export type SaveDraftResult =
  | { gridId: string; error: null; issues: [] }
  | { gridId: null; error: string; issues: GridIssue[] }

export type PublishResult =
  | { version: number; carriedLevels: number; error: null }
  | { version: null; carriedLevels: null; error: string }

export type DeleteGridResult = { error: string | null }
