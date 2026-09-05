import { describe, expect, it } from 'vitest'

import {
  buildProgressPoints,
  computeSessionsPerWeek,
  computeStats,
  computeStreak,
  formatPercent,
  type HistorySession,
} from './stats'

function session(overrides: Partial<HistorySession> = {}): HistorySession {
  return {
    id: 's1',
    gridId: 'g1',
    gridName: 'Ma grille',
    levelId: 'l1',
    levelPosition: 1,
    levelName: null,
    startedAt: '2026-09-01T10:00:00.000Z',
    endedAt: '2026-09-01T10:30:00.000Z',
    validated: false,
    totalSets: 5,
    successfulSets: 5,
    failures: [],
    ...overrides,
  }
}

describe('computeStats', () => {
  it('renvoie des valeurs neutres sans seance', () => {
    const stats = computeStats([])
    expect(stats.sessionCount).toBe(0)
    expect(stats.successRate).toBeNull()
    expect(stats.sessionsPerWeek).toBeNull()
    expect(stats.mostBlocking).toBeNull()
    expect(stats.currentStreak).toBe(0)
  })

  it('agrege les series et le taux de reussite', () => {
    const stats = computeStats([
      session({ totalSets: 5, successfulSets: 5 }),
      session({ id: 's2', totalSets: 5, successfulSets: 3 }),
    ])
    expect(stats.totalSets).toBe(10)
    expect(stats.successfulSets).toBe(8)
    expect(stats.successRate).toBeCloseTo(0.8)
  })

  it('compte les niveaux valides', () => {
    const stats = computeStats([
      session({ validated: true }),
      session({ id: 's2', validated: false }),
    ])
    expect(stats.validatedCount).toBe(1)
  })

  it('designe l exercice le plus bloquant', () => {
    const stats = computeStats([
      session({
        failures: [
          { exerciseName: 'Tractions', repsDone: 2 },
          { exerciseName: 'Gainage', repsDone: null },
        ],
      }),
      session({
        id: 's2',
        failures: [{ exerciseName: 'Tractions', repsDone: 3 }],
      }),
    ])
    expect(stats.mostBlocking).toEqual({ exerciseName: 'Tractions', failures: 2 })
  })

  it('tranche les egalites par ordre alphabetique, pour rester stable', () => {
    const stats = computeStats([
      session({
        failures: [
          { exerciseName: 'Tractions', repsDone: null },
          { exerciseName: 'Dips', repsDone: null },
        ],
      }),
    ])
    expect(stats.mostBlocking?.exerciseName).toBe('Dips')
  })
})

describe('computeSessionsPerWeek', () => {
  it('ne se prononce pas avec moins de deux seances', () => {
    expect(computeSessionsPerWeek([])).toBeNull()
    expect(computeSessionsPerWeek([session()])).toBeNull()
  })

  it('calcule la cadence sur la periode observee', () => {
    // Quatre seances etalees sur exactement deux semaines : deux par semaine.
    const sessions = [
      session({ id: 'a', startedAt: '2026-09-01T10:00:00.000Z' }),
      session({ id: 'b', startedAt: '2026-09-05T10:00:00.000Z' }),
      session({ id: 'c', startedAt: '2026-09-10T10:00:00.000Z' }),
      session({ id: 'd', startedAt: '2026-09-15T10:00:00.000Z' }),
    ]
    expect(computeSessionsPerWeek(sessions)).toBe(2)
  })

  it('ne divise pas par zero quand tout a lieu au meme instant', () => {
    const sessions = [session({ id: 'a' }), session({ id: 'b' })]
    expect(computeSessionsPerWeek(sessions)).toBeNull()
  })
})

describe('computeStreak', () => {
  it('compte un jour pour une seule seance', () => {
    expect(computeStreak([session()])).toBe(1)
  })

  it('compte les jours consecutifs', () => {
    const sessions = [
      session({ id: 'a', startedAt: '2026-09-03T08:00:00.000Z' }),
      session({ id: 'b', startedAt: '2026-09-02T08:00:00.000Z' }),
      session({ id: 'c', startedAt: '2026-09-01T08:00:00.000Z' }),
    ]
    expect(computeStreak(sessions)).toBe(3)
  })

  it('ne compte qu une fois plusieurs seances le meme jour', () => {
    const sessions = [
      session({ id: 'a', startedAt: '2026-09-03T08:00:00.000Z' }),
      session({ id: 'b', startedAt: '2026-09-03T18:00:00.000Z' }),
    ]
    expect(computeStreak(sessions)).toBe(1)
  })

  it('s arrete au premier jour manque', () => {
    const sessions = [
      session({ id: 'a', startedAt: '2026-09-05T08:00:00.000Z' }),
      session({ id: 'b', startedAt: '2026-09-04T08:00:00.000Z' }),
      // trou le 3
      session({ id: 'c', startedAt: '2026-09-02T08:00:00.000Z' }),
    ]
    expect(computeStreak(sessions)).toBe(2)
  })
})

describe('buildProgressPoints', () => {
  it('ignore les seances non validees', () => {
    expect(buildProgressPoints([session({ validated: false })])).toHaveLength(0)
  })

  it('produit un point par niveau franchi, dans l ordre chronologique', () => {
    const sessions = [
      session({
        id: 'b',
        levelId: 'l2',
        levelPosition: 2,
        validated: true,
        startedAt: '2026-09-05T10:00:00.000Z',
      }),
      session({
        id: 'a',
        levelId: 'l1',
        levelPosition: 1,
        validated: true,
        startedAt: '2026-09-01T10:00:00.000Z',
      }),
    ]
    expect(buildProgressPoints(sessions).map((p) => p.levelPosition)).toEqual([1, 2])
  })

  it('ne compte pas deux fois un niveau revalide', () => {
    const sessions = [
      session({
        id: 'a',
        levelId: 'l1',
        validated: true,
        startedAt: '2026-09-01T10:00:00.000Z',
      }),
      session({
        id: 'b',
        levelId: 'l1',
        validated: true,
        startedAt: '2026-09-08T10:00:00.000Z',
      }),
    ]
    expect(buildProgressPoints(sessions)).toHaveLength(1)
  })
})

describe('formatPercent', () => {
  it('affiche un tiret sans donnee', () => {
    expect(formatPercent(null)).toBe('—')
  })

  it('arrondit au pourcent', () => {
    expect(formatPercent(0.836)).toBe('84 %')
  })
})
