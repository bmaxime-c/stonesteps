/**
 * Deroule d'un niveau en une suite de series.
 *
 * La seance est lineaire : exercice par exercice, serie par serie. Aplatir le
 * niveau une bonne fois evite de promener trois index dans l'ecran, et donne
 * une progression calculee sur le total de series du niveau, pas sur le
 * nombre d'exercices.
 */

import type { Level, LevelSet } from '@/lib/grids/model'

export type SetStep = {
  /** Position de la serie dans le niveau, a partir de 0. */
  index: number
  set: LevelSet
  exerciseName: string
  /** Rang de l'exercice dans le niveau, a partir de 1. */
  exerciseNumber: number
  exerciseCount: number
  /** Rang de la serie dans son exercice, a partir de 1. */
  setNumber: number
  setCount: number
}

/** Libelle affiche dans l'en-tete et le resume : « Serie 2/3 ». */
export function setLabel(step: Pick<SetStep, 'setNumber' | 'setCount'>): string {
  return `Serie ${step.setNumber}/${step.setCount}`
}

export function buildSteps(level: Pick<Level, 'exercises'>): SetStep[] {
  const exercises = [...level.exercises].sort((a, b) => a.position - b.position)
  const steps: SetStep[] = []

  exercises.forEach((exercise, exerciseIndex) => {
    const sets = [...exercise.sets].sort((a, b) => a.position - b.position)
    sets.forEach((set, setIndex) => {
      steps.push({
        index: steps.length,
        set,
        exerciseName: exercise.exerciseName,
        exerciseNumber: exerciseIndex + 1,
        exerciseCount: exercises.length,
        setNumber: setIndex + 1,
        setCount: sets.length,
      })
    })
  })

  return steps
}

/**
 * Avancement de la seance, en part du total de series du niveau.
 *
 * `done` est le nombre de series deja validees : la barre se remplit apres
 * chaque validation, pas pendant la serie en cours.
 */
export function progressRatio(done: number, total: number): number {
  if (total <= 0) return 0
  return Math.min(1, Math.max(0, done / total))
}
