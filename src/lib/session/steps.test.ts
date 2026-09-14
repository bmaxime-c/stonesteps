import { describe, expect, it } from 'vitest'

import type { Level, LevelSet } from '@/lib/grids/model'

import { buildSteps, progressRatio, setLabel } from './steps'

function set(position: number, over: Partial<LevelSet> = {}): LevelSet {
  return {
    id: `s${position}`,
    position,
    targetReps: 10,
    timerMode: 'none',
    timerSeconds: null,
    ...over,
  }
}

const level: Level = {
  id: 'l1',
  position: 1,
  exercises: [
    {
      id: 'e2',
      exerciseId: 'x2',
      exerciseName: 'Dips',
      position: 2,
      sets: [set(1), set(2)],
    },
    {
      id: 'e1',
      exerciseId: 'x1',
      exerciseName: 'Pompes',
      position: 1,
      sets: [set(2), set(1), set(3)],
    },
  ],
}

describe('buildSteps', () => {
  it('aplatit le niveau dans l ordre des positions, pas du tableau', () => {
    const steps = buildSteps(level)
    expect(steps.map((s) => `${s.exerciseName} ${s.setNumber}/${s.setCount}`)).toEqual([
      'Pompes 1/3',
      'Pompes 2/3',
      'Pompes 3/3',
      'Dips 1/2',
      'Dips 2/2',
    ])
  })

  it('numerote les series sur le niveau entier', () => {
    expect(buildSteps(level).map((s) => s.index)).toEqual([0, 1, 2, 3, 4])
  })

  it('porte le rang de l exercice et leur nombre', () => {
    const steps = buildSteps(level)
    expect(steps[0].exerciseNumber).toBe(1)
    expect(steps[3].exerciseNumber).toBe(2)
    expect(steps.every((s) => s.exerciseCount === 2)).toBe(true)
  })

  it('trie les series par position a l interieur d un exercice', () => {
    const steps = buildSteps(level)
    expect(steps.slice(0, 3).map((s) => s.set.position)).toEqual([1, 2, 3])
  })

  it('rend une liste vide sur un niveau sans exercice', () => {
    expect(buildSteps({ exercises: [] })).toEqual([])
  })
})

describe('setLabel', () => {
  it('numerote la serie dans son exercice', () => {
    expect(setLabel({ setNumber: 2, setCount: 3 })).toBe('Serie 2/3')
  })
})

describe('progressRatio', () => {
  it('avance apres chaque validation', () => {
    expect(progressRatio(0, 5)).toBe(0)
    expect(progressRatio(2, 5)).toBe(0.4)
    expect(progressRatio(5, 5)).toBe(1)
  })

  it('ne deborde pas et ne divise pas par zero', () => {
    expect(progressRatio(7, 5)).toBe(1)
    expect(progressRatio(-1, 5)).toBe(0)
    expect(progressRatio(1, 0)).toBe(0)
  })
})
