/**
 * Formes du domaine, cote definition.
 *
 * Une grille est une suite ordonnee de niveaux ; un niveau porte ses exercices
 * ordonnes ; un exercice porte ses series ordonnees. Ces types sont ceux que
 * manipule la couche metier : ils ne reprennent pas les colonnes de la base
 * telles quelles (snake_case, identifiants de jointure), mais ce dont les
 * regles ont besoin.
 */

import type { Database } from '@/lib/database.types'

export type TimerMode = Database['public']['Enums']['timer_mode']
export type MuscleGroup = Database['public']['Enums']['muscle_group']

/**
 * Une serie.
 *
 * `timerSeconds` vaut null si et seulement si `timerMode` vaut 'none' — la
 * base porte le meme check. `targetReps` n'est pas lu en mode 'minimal' : on
 * y compare des secondes tenues, pas des repetitions.
 */
export type LevelSet = {
  id: string
  position: number
  targetReps: number
  timerMode: TimerMode
  timerSeconds: number | null
}

export type LevelExercise = {
  id: string
  exerciseId: string
  exerciseName: string
  position: number
  sets: LevelSet[]
}

export type Level = {
  id: string
  position: number
  exercises: LevelExercise[]
}

export type GridVersionStatus = Database['public']['Enums']['grid_version_status']

/**
 * Une version de grille.
 *
 * Le nom, la couleur et le repos vivent ici et non sur la grille : ils font
 * partie de ce qu'on publie. Renommer une grille demande donc de publier, et
 * la promesse « jamais de sauvegarde directe » tient d'un bout a l'autre.
 */
export type GridVersion = {
  id: string
  version: number
  status: GridVersionStatus
  name: string
  accentColor: string
  restSeconds: number
  /**
   * Niveaux acquis d'office a la publication.
   *
   * Fige a la publication : les positions 1 a `carriedLevels` sont considerees
   * validees sans avoir a etre rejouees, parce que leur contenu n'avait pas
   * bouge et qu'elles etaient deja franchies.
   */
  carriedLevels: number
  levels: Level[]
}

/**
 * Une grille : une identite, et ses versions.
 *
 * `published` est la derniere version publiee, la seule jouable. `draft` est
 * le brouillon en cours, au plus un — c'est lui qu'ouvre le constructeur quand
 * il existe.
 */
export type Grid = {
  id: string
  published: GridVersion | null
  draft: GridVersion | null
}

/** Ce que le constructeur ouvre : le brouillon s'il existe, sinon le publie. */
export function editableVersion(grid: Grid): GridVersion | null {
  return grid.draft ?? grid.published
}

/** Ce que l'accueil et la seance affichent : uniquement ce qui est publie. */
export function playableVersion(grid: Grid): GridVersion | null {
  return grid.published
}

/**
 * Ce qu'une grille doit contenir pour etre validable, sans les identifiants.
 *
 * Le constructeur travaille sur un brouillon qui n'a pas encore d'identifiants
 * en base ; `Grid` satisfait cette forme, ce qui permet de valider les deux
 * avec la meme fonction.
 */
export type SetDraft = {
  targetReps: number
  timerMode: TimerMode
  timerSeconds: number | null
}

export type ExerciseDraft = { exerciseName: string; sets: SetDraft[] }
export type LevelDraft = { exercises: ExerciseDraft[] }

export type GridDraft = {
  name: string
  restSeconds: number
  levels: LevelDraft[]
}

/** Unite de mesure d'une serie : des repetitions, ou des secondes. */
export function setUnit(set: Pick<LevelSet, 'timerMode'>): 'reps' | 's' {
  return set.timerMode === 'none' ? 'reps' : 's'
}

/**
 * Objectif chiffre d'une serie, dans son unite.
 *
 * En mode chronometre c'est la duree qui fait foi, jamais `targetReps` : en
 * 'minimal' il faut tenir au moins ce temps, en 'strict' finir en au plus ce
 * temps.
 */
export function setTarget(
  set: Pick<LevelSet, 'targetReps' | 'timerMode' | 'timerSeconds'>,
): number {
  return set.timerMode === 'none' ? set.targetReps : (set.timerSeconds ?? 0)
}

/** Nombre total de series d'un niveau, tous exercices confondus. */
export function levelSetCount(level: Pick<Level, 'exercises'>): number {
  return level.exercises.reduce((total, exercise) => total + exercise.sets.length, 0)
}
