import { describe, expect, it } from 'vitest'

import { TEMPLATE_LEVELS } from './template'
import { MAX_EXERCISES_PER_LEVEL, hasErrors, validateExerciseDraft } from './validation'

describe('grille de reference', () => {
  it('compte dix niveaux', () => {
    expect(TEMPLATE_LEVELS).toHaveLength(10)
  })

  it('respecte la limite d exercices par niveau', () => {
    for (const level of TEMPLATE_LEVELS) {
      expect(level.exercises.length).toBeGreaterThanOrEqual(1)
      expect(level.exercises.length).toBeLessThanOrEqual(MAX_EXERCISES_PER_LEVEL)
    }
  })

  it('ne contient que des exercices valides au sens des regles de saisie', () => {
    for (const [index, level] of TEMPLATE_LEVELS.entries()) {
      for (const exercise of level.exercises) {
        const errors = validateExerciseDraft({
          exerciseId: 'peu-importe',
          sets: exercise.sets,
          reps: exercise.reps,
          timerMode: exercise.timerMode,
          timerSeconds: exercise.timerSeconds,
        })
        expect(
          hasErrors(errors),
          `niveau ${index + 1}, ${exercise.exerciseName} : ${JSON.stringify(errors)}`,
        ).toBe(false)
      }
    }
  })

  it('donne un nom distinct a chaque niveau', () => {
    const names = TEMPLATE_LEVELS.map((level) => level.name)
    expect(new Set(names).size).toBe(names.length)
  })
})
