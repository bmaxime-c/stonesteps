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
   * Nombre de niveaux de tete identiques a la version precedente.
   *
   * Fait universel, fige a la publication : il ne dit rien de ce qu'un
   * utilisateur donne avait franchi. Le report de progression se calcule pour
   * chacun, a la lecture, en bornant ce prefixe par ses propres seances — sans
   * quoi un suiveur heriterait de la progression du createur.
   */
  unchangedPrefix: number
  levels: Level[]
}

/** Suivi d'une grille par l'utilisateur courant. */
export type GridFollow = {
  /**
   * Null : le suivi recoit chaque nouvelle version publiee.
   * Renseigne : le partage a ete retire, le suivi reste fige sur ce numero.
   */
  frozenAtVersion: number | null
}

/**
 * Une grille : une identite, ses versions, et ce que l'utilisateur courant en
 * a.
 *
 * `publishedVersions` porte toutes les versions publiees, dans l'ordre : le
 * report de progression se calcule de proche en proche, et la derniere ne
 * suffit pas. `draft` n'est renseigne que pour le createur — un brouillon ne
 * sort jamais de chez son auteur.
 */
export type Grid = {
  id: string
  ownerId: string
  /** Nom affiche du createur, quand il est lisible. */
  ownerName: string | null
  isPublic: boolean
  /** Renseigne sur une grille supprimee par son createur mais encore suivie. */
  deletedAt: string | null
  owned: boolean
  publishedVersions: GridVersion[]
  draft: GridVersion | null
  follow: GridFollow | null
  /**
   * Nombre de suiveurs.
   *
   * N'a de sens que sur une grille dont on est le createur : ailleurs, la RLS
   * ne laisse voir que son propre suivi, et le compte vaut 0 ou 1.
   */
  followerCount: number
}

/** Derniere version publiee, sans tenir compte d'un eventuel gel. */
export function latestPublished(grid: Grid): GridVersion | null {
  return grid.publishedVersions[grid.publishedVersions.length - 1] ?? null
}

/**
 * Ce que l'accueil et la seance jouent.
 *
 * La derniere version publiee, sauf pour un suivi gele : le createur a retire
 * le partage, et le suiveur garde ce qu'il avait sans recevoir la suite.
 */
export function playableVersion(grid: Grid): GridVersion | null {
  const frozen = grid.follow?.frozenAtVersion
  if (frozen == null) return latestPublished(grid)
  return grid.publishedVersions.find((version) => version.version === frozen) ?? null
}

/**
 * Versions qui comptent pour la progression de l'utilisateur courant.
 *
 * Jusqu'a celle qu'il joue, comprise : au-dela, il n'a rien vu passer.
 */
export function progressionVersions(grid: Grid): GridVersion[] {
  const playable = playableVersion(grid)
  if (!playable) return []
  return grid.publishedVersions.filter((version) => version.version <= playable.version)
}

/** Ce que le constructeur ouvre : le brouillon s'il existe, sinon le publie. */
export function editableVersion(grid: Grid): GridVersion | null {
  return grid.draft ?? latestPublished(grid)
}

/** Une grille dont le createur a retire le partage ne recoit plus de version. */
export function isFrozen(grid: Grid): boolean {
  return grid.follow?.frozenAtVersion != null
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
