import { describe, expect, it } from 'vitest'

import type { SessionRecord, SetResult, SetStatus, SetUnit } from '@/lib/session/model'

import {
  dayKey,
  exerciseNames,
  exerciseProgress,
  gridNames,
  kpis,
  levelAttempts,
  levelProgress,
  regularity,
  statusDistribution,
} from './aggregate'

let nextIndex = 0

function result(
  exerciseName: string,
  actualValue: number,
  targetValue: number,
  status: SetStatus,
  unit: SetUnit = 'reps',
): SetResult {
  nextIndex += 1
  return {
    levelSetId: `ls${nextIndex}`,
    setIndex: nextIndex,
    exerciseName,
    setLabel: 'Série 1/1',
    unit,
    targetValue,
    actualValue,
    status,
  }
}

function session(over: Partial<SessionRecord> = {}): SessionRecord {
  return {
    id: 's1',
    gridId: 'g1',
    gridName: 'Push Day',
    levelNumber: 1,
    startedAt: '2026-08-01T10:00:00Z',
    validated: true,
    results: [],
    ...over,
  }
}

describe('kpis', () => {
  it('compte seances, niveaux valides, reps cumulees et taux de reussite', () => {
    const sessions = [
      session({
        id: 'a',
        levelNumber: 1,
        validated: true,
        results: [
          result('Pompes', 12, 10, 'surpass'),
          result('Pompes', 10, 10, 'success'),
        ],
      }),
      session({
        id: 'b',
        levelNumber: 2,
        validated: false,
        startedAt: '2026-08-08T10:00:00Z',
        results: [result('Pompes', 8, 10, 'fail'), result('Pompes', 10, 10, 'success')],
      }),
    ]

    expect(kpis(sessions)).toEqual({
      sessionCount: 2,
      validatedLevels: 1,
      totalReps: 40,
      successRate: 3 / 4,
    })
  })

  it('agrege les depassements aux reussites, et seulement ici', () => {
    const sessions = [session({ results: [result('Pompes', 12, 10, 'surpass')] })]
    expect(kpis(sessions).successRate).toBe(1)
    expect(statusDistribution(sessions)).toEqual({ success: 0, surpass: 1, fail: 0 })
  })

  it('ne compte pas deux fois un niveau rejoue puis valide', () => {
    const sessions = [
      session({ id: 'a', levelNumber: 3, validated: false }),
      session({ id: 'b', levelNumber: 3, validated: true }),
      session({ id: 'c', levelNumber: 3, validated: true }),
    ]
    expect(kpis(sessions).validatedLevels).toBe(1)
  })

  it('ne compte dans les reps que les series en repetitions', () => {
    const sessions = [
      session({
        results: [
          result('Pompes', 10, 10, 'success'),
          result('Planche', 45, 30, 'surpass', 's'),
        ],
      }),
    ]
    expect(kpis(sessions).totalReps).toBe(10)
  })

  it('ne divise pas par zero sur un historique vide', () => {
    expect(kpis([])).toEqual({
      sessionCount: 0,
      validatedLevels: 0,
      totalReps: 0,
      successRate: 0,
    })
  })
})

describe('selecteurs', () => {
  it('liste les grilles et les exercices de l historique, sans doublon', () => {
    const sessions = [
      session({ gridName: 'Push Day', results: [result('Pompes', 10, 10, 'success')] }),
      session({
        gridName: 'Pull & Core',
        results: [
          result('Tractions', 6, 6, 'success'),
          result('Pompes', 10, 10, 'success'),
        ],
      }),
    ]
    expect(gridNames(sessions)).toEqual(['Push Day', 'Pull & Core'])
    expect(exerciseNames(sessions)).toEqual(['Pompes', 'Tractions'])
  })
})

describe('progression par grille', () => {
  it('rend un point par seance, dans l ordre chronologique', () => {
    const sessions = [
      session({
        id: 'c',
        levelNumber: 3,
        startedAt: '2026-08-15T10:00:00Z',
        validated: true,
      }),
      session({
        id: 'a',
        levelNumber: 2,
        startedAt: '2026-08-01T10:00:00Z',
        validated: false,
      }),
      session({
        id: 'b',
        levelNumber: 2,
        startedAt: '2026-08-08T10:00:00Z',
        validated: true,
      }),
      session({ id: 'x', gridName: 'Autre grille', levelNumber: 9 }),
    ]

    expect(levelProgress(sessions, 'Push Day')).toEqual([
      { startedAt: '2026-08-01T10:00:00Z', levelNumber: 2, validated: false },
      { startedAt: '2026-08-08T10:00:00Z', levelNumber: 2, validated: true },
      { startedAt: '2026-08-15T10:00:00Z', levelNumber: 3, validated: true },
    ])
  })
})

describe('tentatives par niveau', () => {
  it('compte les tentatives et retient la premiere validation', () => {
    const sessions = [
      session({
        id: 'a',
        levelNumber: 1,
        startedAt: '2026-07-01T10:00:00Z',
        validated: true,
      }),
      session({
        id: 'b',
        levelNumber: 2,
        startedAt: '2026-07-08T10:00:00Z',
        validated: false,
      }),
      session({
        id: 'c',
        levelNumber: 2,
        startedAt: '2026-07-15T10:00:00Z',
        validated: false,
      }),
      session({
        id: 'd',
        levelNumber: 2,
        startedAt: '2026-07-22T10:00:00Z',
        validated: true,
      }),
      session({
        id: 'e',
        levelNumber: 2,
        startedAt: '2026-07-29T10:00:00Z',
        validated: true,
      }),
    ]

    expect(levelAttempts(sessions, 'Push Day')).toEqual([
      { levelNumber: 1, attempts: 1, validatedAt: '2026-07-01T10:00:00Z' },
      { levelNumber: 2, attempts: 4, validatedAt: '2026-07-22T10:00:00Z' },
    ])
  })

  it('laisse validatedAt a null tant que le niveau bloque', () => {
    const sessions = [
      session({ id: 'a', levelNumber: 4, validated: false }),
      session({ id: 'b', levelNumber: 4, validated: false }),
    ]
    expect(levelAttempts(sessions, 'Push Day')).toEqual([
      { levelNumber: 4, attempts: 2, validatedAt: null },
    ])
  })
})

describe('progression par exercice', () => {
  it('somme les series d une meme seance et garde le pire statut', () => {
    const sessions = [
      session({
        id: 'a',
        startedAt: '2026-08-01T10:00:00Z',
        results: [
          result('Pompes', 12, 12, 'success'),
          result('Pompes', 10, 12, 'fail'),
          result('Tractions', 6, 6, 'success'),
        ],
      }),
      session({
        id: 'b',
        startedAt: '2026-08-08T10:00:00Z',
        results: [
          result('Pompes', 14, 12, 'surpass'),
          result('Pompes', 13, 12, 'surpass'),
        ],
      }),
    ]

    expect(exerciseProgress(sessions, 'Pompes')).toEqual([
      {
        startedAt: '2026-08-01T10:00:00Z',
        unit: 'reps',
        actual: 22,
        target: 24,
        status: 'fail',
      },
      {
        startedAt: '2026-08-08T10:00:00Z',
        unit: 'reps',
        actual: 27,
        target: 24,
        status: 'surpass',
      },
    ])
  })

  it('n additionne pas des secondes a des repetitions', () => {
    const sessions = [
      session({
        results: [
          result('Planche', 40, 30, 'surpass', 's'),
          result('Planche', 10, 10, 'success', 'reps'),
        ],
      }),
    ]
    expect(exerciseProgress(sessions, 'Planche')).toEqual([
      {
        startedAt: '2026-08-01T10:00:00Z',
        unit: 's',
        actual: 40,
        target: 30,
        status: 'surpass',
      },
    ])
  })

  it('ignore les seances ou l exercice n apparait pas', () => {
    const sessions = [session({ results: [result('Tractions', 6, 6, 'success')] })]
    expect(exerciseProgress(sessions, 'Pompes')).toEqual([])
  })
})

describe('repartition des statuts', () => {
  it('compte les trois statuts sur tout l historique', () => {
    const sessions = [
      session({
        results: [result('Pompes', 10, 10, 'success'), result('Pompes', 8, 10, 'fail')],
      }),
      session({ id: 'b', results: [result('Pompes', 12, 10, 'surpass')] }),
    ]
    expect(statusDistribution(sessions)).toEqual({ success: 1, surpass: 1, fail: 1 })
  })
})

describe('regularite', () => {
  // Les dates sont construites en heure locale, comme la fonction : le test
  // ne depend donc pas du fuseau de la machine.
  const today = new Date(2026, 8, 14, 12, 0, 0)
  const daysAgo = (n: number) => {
    const date = new Date(today)
    date.setDate(date.getDate() - n)
    return date
  }

  it('rend une case par jour, du plus ancien au plus recent', () => {
    const days = regularity([], today)
    expect(days).toHaveLength(35)
    expect(days[34].day).toBe(dayKey(today))
    expect(days[0].day).toBe(dayKey(daysAgo(34)))
    expect(days.every((d) => !d.active)).toBe(true)
  })

  it('marque les jours ou une seance a eu lieu', () => {
    const sessions = [
      session({ id: 'a', startedAt: today.toISOString() }),
      session({ id: 'b', startedAt: daysAgo(3).toISOString() }),
      session({ id: 'c', startedAt: daysAgo(3).toISOString() }),
    ]
    const days = regularity(sessions, today)
    expect(days[34].active).toBe(true)
    expect(days[31].active).toBe(true)
    expect(days.filter((d) => d.active)).toHaveLength(2)
  })

  it('ignore les seances plus anciennes que la fenetre', () => {
    const sessions = [session({ startedAt: daysAgo(40).toISOString() })]
    expect(regularity(sessions, today).every((d) => !d.active)).toBe(true)
  })
})
