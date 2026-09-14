import { describe, expect, it } from 'vitest'

import type { GridDraft, SetDraft } from './model'
import { isGridValid, validateGrid } from './validation'

function reps(targetReps = 10): SetDraft {
  return { targetReps, timerMode: 'none', timerSeconds: null }
}

function grid(over: Partial<GridDraft> = {}): GridDraft {
  return {
    name: 'Push Day',
    restSeconds: 60,
    levels: [{ exercises: [{ exerciseName: 'Pompes', sets: [reps()] }] }],
    ...over,
  }
}

const paths = (draft: GridDraft) => validateGrid(draft).map((issue) => issue.path)

describe('grille valide', () => {
  it('ne remonte rien sur une grille minimale', () => {
    expect(validateGrid(grid())).toEqual([])
    expect(isGridValid(grid())).toBe(true)
  })

  it('accepte un repos desactive', () => {
    expect(isGridValid(grid({ restSeconds: 0 }))).toBe(true)
  })
})

describe('nom', () => {
  it('refuse un nom vide ou en blancs', () => {
    expect(paths(grid({ name: '' }))).toContain('name')
    expect(paths(grid({ name: '   ' }))).toContain('name')
  })

  it('refuse un nom trop long', () => {
    expect(paths(grid({ name: 'x'.repeat(61) }))).toContain('name')
  })
})

describe('repos', () => {
  it('refuse hors des bornes de la base', () => {
    expect(paths(grid({ restSeconds: -1 }))).toContain('restSeconds')
    expect(paths(grid({ restSeconds: 301 }))).toContain('restSeconds')
  })

  it('refuse une valeur non entiere', () => {
    expect(paths(grid({ restSeconds: 12.5 }))).toContain('restSeconds')
  })
})

describe('structure', () => {
  it('exige au moins un niveau', () => {
    expect(paths(grid({ levels: [] }))).toContain('levels')
  })

  it('exige au moins un exercice par niveau', () => {
    const draft = grid({ levels: [{ exercises: [] }] })
    expect(paths(draft)).toContain('levels.0')
  })

  it('exige au moins une serie par exercice', () => {
    const draft = grid({
      levels: [{ exercises: [{ exerciseName: 'Pompes', sets: [] }] }],
    })
    expect(paths(draft)).toContain('levels.0.exercises.0')
  })

  it('situe le probleme sur le bon niveau', () => {
    const draft = grid({
      levels: [
        { exercises: [{ exerciseName: 'Pompes', sets: [reps()] }] },
        { exercises: [] },
      ],
    })
    expect(paths(draft)).toEqual(['levels.1'])
  })
})

describe('coherence du chrono', () => {
  const withSet = (set: SetDraft) =>
    grid({ levels: [{ exercises: [{ exerciseName: 'Planche', sets: [set] }] }] })

  it('refuse une duree sur une serie sans chrono', () => {
    const draft = withSet({ targetReps: 10, timerMode: 'none', timerSeconds: 30 })
    expect(paths(draft)).toContain('levels.0.exercises.0.sets.0')
  })

  it('refuse une serie chronometree sans duree', () => {
    const draft = withSet({ targetReps: 10, timerMode: 'minimal', timerSeconds: null })
    expect(paths(draft)).toContain('levels.0.exercises.0.sets.0')
  })

  it('refuse une duree sous le plancher de cinq secondes', () => {
    const draft = withSet({ targetReps: 10, timerMode: 'strict', timerSeconds: 4 })
    expect(paths(draft)).toContain('levels.0.exercises.0.sets.0')
  })

  it('accepte une serie chronometree correcte', () => {
    const draft = withSet({ targetReps: 1, timerMode: 'minimal', timerSeconds: 30 })
    expect(validateGrid(draft)).toEqual([])
  })
})

describe('repetitions', () => {
  it('refuse un objectif negatif', () => {
    const draft = grid({
      levels: [{ exercises: [{ exerciseName: 'Pompes', sets: [reps(-1)] }] }],
    })
    expect(paths(draft)).toContain('levels.0.exercises.0.sets.0')
  })

  it('accepte un objectif a zero', () => {
    const draft = grid({
      levels: [{ exercises: [{ exerciseName: 'Pompes', sets: [reps(0)] }] }],
    })
    expect(validateGrid(draft)).toEqual([])
  })
})
