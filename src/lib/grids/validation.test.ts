import { describe, expect, it } from 'vitest'

import {
  describeExercise,
  hasErrors,
  moveItem,
  validateExerciseDraft,
  type ExerciseDraft,
} from './validation'

function draft(overrides: Partial<ExerciseDraft> = {}): ExerciseDraft {
  return {
    exerciseId: 'ex-1',
    sets: 3,
    reps: 8,
    timerMode: 'none',
    timerSeconds: null,
    ...overrides,
  }
}

describe('validateExerciseDraft', () => {
  it('accepte un exercice en repetitions', () => {
    expect(hasErrors(validateExerciseDraft(draft()))).toBe(false)
  })

  it('accepte un gainage sans repetitions', () => {
    const errors = validateExerciseDraft(
      draft({ reps: null, timerMode: 'minimal', timerSeconds: 30 }),
    )
    expect(hasErrors(errors)).toBe(false)
  })

  it('accepte des repetitions chronometrees', () => {
    const errors = validateExerciseDraft(
      draft({ reps: 10, timerMode: 'strict', timerSeconds: 15 }),
    )
    expect(hasErrors(errors)).toBe(false)
  })

  it('refuse un exercice sans exercice choisi', () => {
    expect(validateExerciseDraft(draft({ exerciseId: '' })).exerciseId).toBeDefined()
  })

  it('refuse un nombre de series hors bornes', () => {
    expect(validateExerciseDraft(draft({ sets: 0 })).sets).toBeDefined()
    expect(validateExerciseDraft(draft({ sets: 21 })).sets).toBeDefined()
  })

  it('refuse un chrono sans duree', () => {
    const errors = validateExerciseDraft(
      draft({ timerMode: 'minimal', timerSeconds: null }),
    )
    expect(errors.timerSeconds).toBeDefined()
  })

  it('refuse une duree sans chrono', () => {
    const errors = validateExerciseDraft(draft({ timerMode: 'none', timerSeconds: 30 }))
    expect(errors.timerSeconds).toBeDefined()
  })

  it('refuse un exercice qui ne se mesure ni en repetitions ni en duree', () => {
    const errors = validateExerciseDraft(draft({ reps: null, timerMode: 'none' }))
    expect(errors.reps).toBeDefined()
  })

  it('refuse des repetitions non entieres', () => {
    expect(validateExerciseDraft(draft({ reps: 2.5 })).reps).toBeDefined()
  })
})

describe('describeExercise', () => {
  it('decrit des series en repetitions', () => {
    expect(
      describeExercise({ sets: 3, reps: 8, timerMode: 'none', timerSeconds: null }),
    ).toBe('3 x 8')
  })

  it('decrit un gainage', () => {
    expect(
      describeExercise({ sets: 3, reps: null, timerMode: 'minimal', timerSeconds: 30 }),
    ).toBe('3 series de 30 s minimum')
  })

  it('decrit une serie chronometree strictement', () => {
    expect(
      describeExercise({ sets: 4, reps: 10, timerMode: 'strict', timerSeconds: 15 }),
    ).toBe('4 x 10 en moins de 15 s')
  })

  it('decrit une descente lente', () => {
    expect(
      describeExercise({ sets: 3, reps: 5, timerMode: 'minimal', timerSeconds: 20 }),
    ).toBe('3 x 5 — 20 s minimum')
  })
})

describe('moveItem', () => {
  const items = ['a', 'b', 'c']

  it('deplace un element vers le haut', () => {
    expect(moveItem(items, 1, -1)).toEqual(['b', 'a', 'c'])
  })

  it('deplace un element vers le bas', () => {
    expect(moveItem(items, 1, 1)).toEqual(['a', 'c', 'b'])
  })

  it('ne fait rien au-dela des bornes', () => {
    expect(moveItem(items, 0, -1)).toEqual(items)
    expect(moveItem(items, 2, 1)).toEqual(items)
  })

  it('ne modifie pas la liste d origine', () => {
    const original = [...items]
    moveItem(items, 1, -1)
    expect(items).toEqual(original)
  })
})
