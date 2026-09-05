import type { TimerMode } from '@/lib/database.types'

/**
 * Regle centrale de StoneSteps.
 *
 * Un niveau n'est valide que si TOUTES les series de TOUS ses exercices sont
 * reussies. Une seule serie manquee invalide le niveau entier, et la seance
 * suivante repart de ce meme niveau.
 *
 * Tout est pur et sans dependance : c'est la partie du code qui doit rester
 * verifiable sans base ni navigateur.
 */

export interface PlannedExercise {
  id: string
  exerciseName: string
  position: number
  sets: number
  reps: number | null
  timerMode: TimerMode
  timerSeconds: number | null
}

export interface PlannedLevel {
  id: string
  position: number
  name: string | null
  exercises: PlannedExercise[]
}

export interface SetOutcome {
  levelExerciseId: string
  setIndex: number
  success: boolean
  repsDone: number | null
  durationSeconds: number | null
}

/** Une case du parcours : un exercice, une serie. */
export interface SetSlot {
  levelExerciseId: string
  exerciseName: string
  exercisePosition: number
  setIndex: number
  setCount: number
  reps: number | null
  timerMode: TimerMode
  timerSeconds: number | null
}

/**
 * Deroule le niveau en une suite plate de series, dans l'ordre d'execution :
 * toutes les series du premier exercice, puis celles du deuxieme, etc.
 */
export function buildSetSlots(level: PlannedLevel): SetSlot[] {
  return [...level.exercises]
    .sort((a, b) => a.position - b.position)
    .flatMap((exercise) =>
      Array.from({ length: exercise.sets }, (_, index) => ({
        levelExerciseId: exercise.id,
        exerciseName: exercise.exerciseName,
        exercisePosition: exercise.position,
        setIndex: index + 1,
        setCount: exercise.sets,
        reps: exercise.reps,
        timerMode: exercise.timerMode,
        timerSeconds: exercise.timerSeconds,
      })),
    )
}

function outcomeKey(levelExerciseId: string, setIndex: number): string {
  return `${levelExerciseId}#${setIndex}`
}

/** Indexe les resultats par (exercice, serie). Le dernier enregistre l'emporte. */
export function indexOutcomes(outcomes: readonly SetOutcome[]): Map<string, SetOutcome> {
  const byKey = new Map<string, SetOutcome>()
  for (const outcome of outcomes) {
    byKey.set(outcomeKey(outcome.levelExerciseId, outcome.setIndex), outcome)
  }
  return byKey
}

export function findOutcome(
  outcomes: readonly SetOutcome[],
  levelExerciseId: string,
  setIndex: number,
): SetOutcome | undefined {
  return indexOutcomes(outcomes).get(outcomeKey(levelExerciseId, setIndex))
}

/**
 * Le niveau est-il valide ?
 *
 * Exige un resultat reussi pour chaque serie prevue. Un niveau sans exercice
 * n'est jamais valide : il n'y a rien a reussir.
 */
export function isLevelValidated(
  level: PlannedLevel,
  outcomes: readonly SetOutcome[],
): boolean {
  const slots = buildSetSlots(level)
  if (slots.length === 0) return false

  const byKey = indexOutcomes(outcomes)
  return slots.every(
    (slot) =>
      byKey.get(outcomeKey(slot.levelExerciseId, slot.setIndex))?.success === true,
  )
}

/** Nombre de series deja renseignees, reussies ou non. */
export function countRecorded(
  level: PlannedLevel,
  outcomes: readonly SetOutcome[],
): number {
  const slots = buildSetSlots(level)
  const byKey = indexOutcomes(outcomes)
  return slots.filter((slot) =>
    byKey.has(outcomeKey(slot.levelExerciseId, slot.setIndex)),
  ).length
}

/** Series echouees, pour le recapitulatif de fin de seance. */
export function listFailures(
  level: PlannedLevel,
  outcomes: readonly SetOutcome[],
): SetOutcome[] {
  const slots = buildSetSlots(level)
  const byKey = indexOutcomes(outcomes)
  return slots
    .map((slot) => byKey.get(outcomeKey(slot.levelExerciseId, slot.setIndex)))
    .filter((outcome): outcome is SetOutcome => outcome !== undefined && !outcome.success)
}

/**
 * Prochaine serie a faire : la premiere du parcours qui n'a pas de resultat.
 * Renvoie -1 quand tout est renseigne.
 */
export function nextSlotIndex(
  slots: readonly SetSlot[],
  outcomes: readonly SetOutcome[],
): number {
  const byKey = indexOutcomes(outcomes)
  return slots.findIndex(
    (slot) => !byKey.has(outcomeKey(slot.levelExerciseId, slot.setIndex)),
  )
}

/**
 * Niveau auquel demarrer : le premier, dans l'ordre, qui n'a jamais ete valide.
 * Renvoie null si la grille est entierement validee — ou vide.
 */
export function resolveResumeLevel(
  levels: readonly PlannedLevel[],
  validatedLevelIds: ReadonlySet<string>,
): PlannedLevel | null {
  const ordered = [...levels].sort((a, b) => a.position - b.position)
  return ordered.find((level) => !validatedLevelIds.has(level.id)) ?? null
}
