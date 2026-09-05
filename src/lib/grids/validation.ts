import type { TimerMode } from '@/lib/database.types'

/**
 * Regles de saisie de l'editeur.
 *
 * Elles doublent les contraintes SQL de `level_exercises` et `levels`. Ce
 * n'est pas de la redondance inutile : la base reste l'autorite, mais un
 * message d'erreur lisible vaut mieux qu'une violation de contrainte remontee
 * brute a l'utilisateur.
 */

export const MAX_EXERCISES_PER_LEVEL = 10
export const MIN_SETS = 1
export const MAX_SETS = 20

export const TIMER_MODES: readonly TimerMode[] = ['none', 'minimal', 'strict']

export const TIMER_MODE_LABELS: Record<TimerMode, string> = {
  none: 'Sans chrono',
  minimal: 'Tenir au moins',
  strict: 'Finir en moins de',
}

export const TIMER_MODE_HINTS: Record<TimerMode, string> = {
  none: 'La serie se compte en repetitions.',
  minimal: 'Gainage, descente lente : il faut tenir la duree indiquee.',
  strict: 'Series explosives : il faut finir avant la fin du temps imparti.',
}

export interface ExerciseDraft {
  exerciseId: string
  sets: number
  reps: number | null
  timerMode: TimerMode
  timerSeconds: number | null
}

export type FieldErrors = Partial<Record<keyof ExerciseDraft, string>>

export function validateExerciseDraft(draft: ExerciseDraft): FieldErrors {
  const errors: FieldErrors = {}

  if (!draft.exerciseId) {
    errors.exerciseId = 'Choisis un exercice.'
  }

  if (!Number.isInteger(draft.sets) || draft.sets < MIN_SETS || draft.sets > MAX_SETS) {
    errors.sets = `Le nombre de series doit etre compris entre ${MIN_SETS} et ${MAX_SETS}.`
  }

  if (draft.reps !== null && (!Number.isInteger(draft.reps) || draft.reps < 1)) {
    errors.reps = 'Le nombre de repetitions doit etre un entier positif.'
  }

  if (draft.timerMode === 'none') {
    if (draft.timerSeconds !== null) {
      errors.timerSeconds = 'Sans chrono, aucune duree ne doit etre saisie.'
    }
  } else if (
    draft.timerSeconds === null ||
    !Number.isInteger(draft.timerSeconds) ||
    draft.timerSeconds < 1
  ) {
    errors.timerSeconds = 'Indique une duree en secondes.'
  }

  // Un exercice doit se mesurer : en repetitions, en duree, ou les deux.
  if (draft.reps === null && draft.timerMode === 'none') {
    errors.reps = 'Indique un nombre de repetitions, ou active un chrono.'
  }

  return errors
}

export function hasErrors(errors: FieldErrors): boolean {
  return Object.keys(errors).length > 0
}

/** Resume lisible d'un exercice : « 3 x 8 », « 3 x 30 s minimum ». */
export function describeExercise(draft: {
  sets: number
  reps: number | null
  timerMode: TimerMode
  timerSeconds: number | null
}): string {
  const parts: string[] = []

  if (draft.reps !== null) {
    parts.push(`${draft.sets} x ${draft.reps}`)
  } else {
    parts.push(`${draft.sets} series`)
  }

  if (draft.timerMode === 'minimal' && draft.timerSeconds !== null) {
    parts.push(
      draft.reps === null
        ? `de ${draft.timerSeconds} s minimum`
        : `— ${draft.timerSeconds} s minimum`,
    )
  }

  if (draft.timerMode === 'strict' && draft.timerSeconds !== null) {
    parts.push(`en moins de ${draft.timerSeconds} s`)
  }

  return parts.join(' ')
}

/**
 * Deplace un element d'une position, et renvoie la liste reordonnee.
 * Renvoie la liste inchangee si le deplacement sort des bornes.
 */
export function moveItem<T>(items: readonly T[], from: number, direction: -1 | 1): T[] {
  const to = from + direction
  if (from < 0 || from >= items.length || to < 0 || to >= items.length) {
    return [...items]
  }

  const next = [...items]
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  return next
}
