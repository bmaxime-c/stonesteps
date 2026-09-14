/**
 * Brouillon de grille manipule par le constructeur.
 *
 * Le constructeur travaille hors ligne sur cette structure et n'enregistre
 * qu'a la fin, en une action. Toutes les operations sont pures et rendent un
 * nouveau brouillon : c'est ce qui les rend testables sans monter l'interface,
 * et c'est la ou vivent les regles d'edition — le pas de reglage, le cycle des
 * modes, la duplication d'un niveau.
 *
 * Chaque element porte une `key` stable, qui ne sert qu'a React : deux series
 * identiques d'un meme exercice ne se distinguent par rien d'autre, et les
 * reordonner par index ferait perdre l'etat des champs.
 */

import type { Grid, GridDraft, TimerMode } from './model'

export const REPS_STEP = 1
export const SECONDS_STEP = 5
export const SECONDS_MIN = 5
export const REST_STEP = 15
export const REST_MIN = 0
export const REST_MAX = 300
export const DEFAULT_TIMER_SECONDS = 30
export const DEFAULT_TARGET_REPS = 10
export const DEFAULT_REST_SECONDS = 15

export type EditableSet = {
  key: string
  targetReps: number
  timerMode: TimerMode
  timerSeconds: number | null
}

export type EditableExercise = {
  key: string
  exerciseId: string
  exerciseName: string
  sets: EditableSet[]
}

export type EditableLevel = {
  key: string
  exercises: EditableExercise[]
}

export type EditableGrid = {
  name: string
  accentColor: string
  restSeconds: number
  levels: EditableLevel[]
}

// Les cles n'ont pas a etre devinables ni a survivre a un rechargement : un
// compteur suffit, et reste lisible dans les outils de developpement.
let keyCounter = 0
function nextKey(prefix: string): string {
  keyCounter += 1
  return `${prefix}-${keyCounter}`
}

export function newSet(over: Partial<Omit<EditableSet, 'key'>> = {}): EditableSet {
  return {
    key: nextKey('set'),
    targetReps: DEFAULT_TARGET_REPS,
    timerMode: 'none',
    timerSeconds: null,
    ...over,
  }
}

export function emptyGrid(): EditableGrid {
  return {
    name: '',
    accentColor: '#00FF87',
    restSeconds: DEFAULT_REST_SECONDS,
    // Une grille commence avec un niveau : un constructeur vide n'offrirait
    // nulle part ou deposer le premier exercice.
    levels: [{ key: nextKey('level'), exercises: [] }],
  }
}

/** Charge une grille existante dans le constructeur. */
export function fromGrid(grid: Grid): EditableGrid {
  return {
    name: grid.name,
    accentColor: grid.accentColor,
    restSeconds: grid.restSeconds,
    levels: grid.levels.map((level) => ({
      key: nextKey('level'),
      exercises: level.exercises.map((exercise) => ({
        key: nextKey('exercise'),
        exerciseId: exercise.exerciseId,
        exerciseName: exercise.exerciseName,
        sets: exercise.sets.map((set) => ({
          key: nextKey('set'),
          targetReps: set.targetReps,
          timerMode: set.timerMode,
          timerSeconds: set.timerSeconds,
        })),
      })),
    })),
  }
}

/** Forme attendue par la validation, debarrassee des cles d'affichage. */
export function toGridDraft(grid: EditableGrid): GridDraft {
  return {
    name: grid.name,
    restSeconds: grid.restSeconds,
    levels: grid.levels.map((level) => ({
      exercises: level.exercises.map((exercise) => ({
        exerciseName: exercise.exerciseName,
        sets: exercise.sets.map((set) => ({
          targetReps: set.targetReps,
          timerMode: set.timerMode,
          timerSeconds: set.timerSeconds,
        })),
      })),
    })),
  }
}

// ---------------------------------------------------------------------------
// Niveaux
// ---------------------------------------------------------------------------

export function addLevel(grid: EditableGrid): EditableGrid {
  return { ...grid, levels: [...grid.levels, { key: nextKey('level'), exercises: [] }] }
}

/** Le dernier niveau ne se supprime pas : une grille en a toujours au moins un. */
export function removeLevel(grid: EditableGrid, levelIndex: number): EditableGrid {
  if (grid.levels.length <= 1) return grid
  return { ...grid, levels: grid.levels.filter((_, index) => index !== levelIndex) }
}

/**
 * Recopie le niveau precedent dans le niveau vise.
 *
 * C'est la facon normale de construire une grille : on duplique, puis on monte
 * la charge d'un cran. Sans cela, chaque niveau se ressaisit en entier.
 */
export function duplicatePreviousLevel(
  grid: EditableGrid,
  levelIndex: number,
): EditableGrid {
  const previous = grid.levels[levelIndex - 1]
  if (!previous) return grid

  const copy: EditableLevel = {
    key: grid.levels[levelIndex].key,
    exercises: previous.exercises.map((exercise) => ({
      key: nextKey('exercise'),
      exerciseId: exercise.exerciseId,
      exerciseName: exercise.exerciseName,
      sets: exercise.sets.map((set) => ({ ...set, key: nextKey('set') })),
    })),
  }

  return {
    ...grid,
    levels: grid.levels.map((level, index) => (index === levelIndex ? copy : level)),
  }
}

// ---------------------------------------------------------------------------
// Exercices et series
// ---------------------------------------------------------------------------

function mapLevel(
  grid: EditableGrid,
  levelIndex: number,
  change: (level: EditableLevel) => EditableLevel,
): EditableGrid {
  return {
    ...grid,
    levels: grid.levels.map((level, index) =>
      index === levelIndex ? change(level) : level,
    ),
  }
}

function mapExercise(
  grid: EditableGrid,
  levelIndex: number,
  exerciseIndex: number,
  change: (exercise: EditableExercise) => EditableExercise,
): EditableGrid {
  return mapLevel(grid, levelIndex, (level) => ({
    ...level,
    exercises: level.exercises.map((exercise, index) =>
      index === exerciseIndex ? change(exercise) : exercise,
    ),
  }))
}

/** Un exercice ajoute depuis la bibliotheque arrive avec une serie par defaut. */
export function addExercise(
  grid: EditableGrid,
  levelIndex: number,
  exercise: { exerciseId: string; exerciseName: string },
): EditableGrid {
  return mapLevel(grid, levelIndex, (level) => ({
    ...level,
    exercises: [
      ...level.exercises,
      {
        key: nextKey('exercise'),
        exerciseId: exercise.exerciseId,
        exerciseName: exercise.exerciseName,
        sets: [newSet()],
      },
    ],
  }))
}

export function removeExercise(
  grid: EditableGrid,
  levelIndex: number,
  exerciseIndex: number,
): EditableGrid {
  return mapLevel(grid, levelIndex, (level) => ({
    ...level,
    exercises: level.exercises.filter((_, index) => index !== exerciseIndex),
  }))
}

/** « Ajouter une serie » duplique la derniere : on ajoute rarement autre chose. */
export function addSet(
  grid: EditableGrid,
  levelIndex: number,
  exerciseIndex: number,
): EditableGrid {
  return mapExercise(grid, levelIndex, exerciseIndex, (exercise) => {
    const last = exercise.sets[exercise.sets.length - 1]
    return {
      ...exercise,
      sets: [...exercise.sets, last ? { ...last, key: nextKey('set') } : newSet()],
    }
  })
}

export function removeSet(
  grid: EditableGrid,
  levelIndex: number,
  exerciseIndex: number,
  setIndex: number,
): EditableGrid {
  return mapExercise(grid, levelIndex, exerciseIndex, (exercise) => ({
    ...exercise,
    sets: exercise.sets.filter((_, index) => index !== setIndex),
  }))
}

export function updateSet(
  grid: EditableGrid,
  levelIndex: number,
  exerciseIndex: number,
  setIndex: number,
  change: (set: EditableSet) => EditableSet,
): EditableGrid {
  return mapExercise(grid, levelIndex, exerciseIndex, (exercise) => ({
    ...exercise,
    sets: exercise.sets.map((set, index) => (index === setIndex ? change(set) : set)),
  }))
}

// ---------------------------------------------------------------------------
// Reglages d'une serie
// ---------------------------------------------------------------------------

const MODE_CYCLE: TimerMode[] = ['none', 'minimal', 'strict']

export const MODE_LABELS: Record<TimerMode, string> = {
  none: 'Sans chrono',
  minimal: 'Tenir au moins',
  strict: 'Faire en max',
}

/**
 * Fait tourner le mode de chrono : sans chrono, tenir au moins, faire en max.
 *
 * Passer a un mode chronometre pose une duree par defaut, en revenir la
 * retire : la base refuse toute autre combinaison, et une duree orpheline
 * reapparaitrait au prochain passage.
 */
export function cycleTimerMode(set: EditableSet): EditableSet {
  const next = MODE_CYCLE[(MODE_CYCLE.indexOf(set.timerMode) + 1) % MODE_CYCLE.length]

  if (next === 'none') return { ...set, timerMode: next, timerSeconds: null }
  return {
    ...set,
    timerMode: next,
    timerSeconds: set.timerSeconds ?? DEFAULT_TIMER_SECONDS,
  }
}

export function stepReps(set: EditableSet, delta: number): EditableSet {
  return { ...set, targetReps: Math.max(0, set.targetReps + delta * REPS_STEP) }
}

export function stepSeconds(set: EditableSet, delta: number): EditableSet {
  if (set.timerMode === 'none') return set
  const base = set.timerSeconds ?? DEFAULT_TIMER_SECONDS
  return { ...set, timerSeconds: Math.max(SECONDS_MIN, base + delta * SECONDS_STEP) }
}

export function stepRest(grid: EditableGrid, delta: number): EditableGrid {
  const next = grid.restSeconds + delta * REST_STEP
  return { ...grid, restSeconds: Math.min(REST_MAX, Math.max(REST_MIN, next)) }
}

/**
 * Le pas de repetitions n'a pas de sens en mode « tenir au moins » : la valeur
 * n'est lue nulle part. Le constructeur le masque plutot que de laisser saisir
 * une valeur morte.
 */
export function showsReps(set: Pick<EditableSet, 'timerMode'>): boolean {
  return set.timerMode !== 'minimal'
}

export function showsSeconds(set: Pick<EditableSet, 'timerMode'>): boolean {
  return set.timerMode !== 'none'
}
