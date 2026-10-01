import { describe, expect, it } from 'vitest'

import type { Level, LevelSet } from '@/lib/grids/model'
import type { SetResult } from '@/lib/session/model'
import { buildSteps } from '@/lib/session/steps'

import { canAdvance, fillSkipped, nextRoomStep, restRemaining } from './flow'
import type { RoomMember } from './model'

function member(userId: string, declaredCursor: number): RoomMember {
  return {
    userId,
    displayName: userId,
    levelCeiling: 3,
    declaredCursor,
    lastStatus: declaredCursor >= 0 ? 'success' : null,
    joinedAt: '2026-10-01T10:00:00Z',
  }
}

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

// Cinq series a plat : trois de pompes, deux de gainage chronometre.
const level: Level = {
  id: 'l1',
  position: 1,
  exercises: [
    {
      id: 'e1',
      exerciseId: 'x1',
      exerciseName: 'Pompes',
      imageUrl: null,
      position: 1,
      sets: [set(1), set(2), set(3)],
    },
    {
      id: 'e2',
      exerciseId: 'x2',
      exerciseName: 'Gainage',
      imageUrl: null,
      position: 2,
      sets: [
        { ...set(1, { timerMode: 'minimal', timerSeconds: 30 }), id: 'g1' },
        { ...set(2, { timerMode: 'minimal', timerSeconds: 30 }), id: 'g2' },
      ],
    },
  ],
}

const steps = buildSteps(level)

function result(setIndex: number): SetResult {
  return {
    levelSetId: steps[setIndex].set.id,
    setIndex,
    exerciseName: steps[setIndex].exerciseName,
    setLabel: 'Série 1/3',
    unit: 'reps',
    targetValue: 10,
    actualValue: 12,
    status: 'surpass',
  }
}

describe('canAdvance', () => {
  const running = { status: 'running' as const, stage: 'set' as const, cursor: 2 }

  it('vrai quand tous les presents ont declare la serie du curseur', () => {
    const room = { ...running, members: [member('a', 2), member('b', 2)] }
    expect(canAdvance(room, new Set(['a', 'b']))).toBe(true)
  })

  it('faux tant qu un present n a pas declare', () => {
    const room = { ...running, members: [member('a', 2), member('b', 1)] }
    expect(canAdvance(room, new Set(['a', 'b']))).toBe(false)
  })

  it('un absent non declare ne bloque pas le groupe', () => {
    const room = { ...running, members: [member('a', 2), member('b', 1)] }
    expect(canAdvance(room, new Set(['a']))).toBe(true)
  })

  it('un present inconnu du salon est ignore, comme en base', () => {
    const room = { ...running, members: [member('a', 2)] }
    expect(canAdvance(room, new Set(['a', 'intrus']))).toBe(true)
  })

  it('faux pendant le repos : il se termine au chrono, pas aux declarations', () => {
    const room = { ...running, stage: 'rest' as const, members: [member('a', 2)] }
    expect(canAdvance(room, new Set(['a']))).toBe(false)
  })

  it('faux hors d un salon lance', () => {
    const room = { ...running, status: 'finished' as const, members: [member('a', 2)] }
    expect(canAdvance(room, new Set(['a']))).toBe(false)
  })
})

describe('nextRoomStep', () => {
  it('serie non derniere avec repos : repos sur le meme curseur', () => {
    expect(nextRoomStep({ cursor: 1, stage: 'set' }, 5, 60)).toEqual({
      cursor: 1,
      stage: 'rest',
    })
  })

  it('repos nul : serie suivante directement', () => {
    expect(nextRoomStep({ cursor: 1, stage: 'set' }, 5, 0)).toEqual({
      cursor: 2,
      stage: 'set',
    })
  })

  it('fin du repos : serie suivante', () => {
    expect(nextRoomStep({ cursor: 1, stage: 'rest' }, 5, 60)).toEqual({
      cursor: 2,
      stage: 'set',
    })
  })

  it('derniere serie : fin du niveau, sans repos', () => {
    expect(nextRoomStep({ cursor: 4, stage: 'set' }, 5, 60)).toEqual({
      cursor: 4,
      stage: 'finished',
    })
  })

  it('un salon termine ne bouge plus', () => {
    expect(nextRoomStep({ cursor: 4, stage: 'finished' }, 5, 60)).toEqual({
      cursor: 4,
      stage: 'finished',
    })
  })
})

describe('fillSkipped', () => {
  it('ajoute en echec, valeur 0, les series passees sans declaration', () => {
    const filled = fillSkipped(
      [result(0), result(1), result(2)],
      { cursor: 4, stage: 'set' },
      steps,
    )

    expect(filled.map((r) => r.setIndex)).toEqual([0, 1, 2, 3])
    expect(filled[3]).toEqual({
      levelSetId: 'g1',
      setIndex: 3,
      exerciseName: 'Gainage',
      setLabel: 'Série 1/2',
      unit: 's',
      targetValue: 30,
      actualValue: 0,
      status: 'fail',
    })
  })

  it('ne duplique pas une serie deja jouee', () => {
    const results = [result(0), result(1), result(2), result(3)]
    expect(fillSkipped(results, { cursor: 4, stage: 'set' }, steps)).toEqual(results)
  })

  it('pendant le repos, la serie du curseur est close', () => {
    const filled = fillSkipped([result(0)], { cursor: 1, stage: 'rest' }, steps)
    expect(filled.map((r) => [r.setIndex, r.status])).toEqual([
      [0, 'surpass'],
      [1, 'fail'],
    ])
  })

  it('a la fin du niveau, la derniere serie est close', () => {
    const filled = fillSkipped(
      [0, 1, 2, 3].map(result),
      { cursor: 4, stage: 'finished' },
      steps,
    )
    expect(filled.map((r) => r.setIndex)).toEqual([0, 1, 2, 3, 4])
    expect(filled[4].status).toBe('fail')
  })

  it('laisse en paix la serie en cours', () => {
    const results = [result(0)]
    expect(fillSkipped(results, { cursor: 1, stage: 'set' }, steps)).toEqual(results)
  })
})

describe('restRemaining', () => {
  const startedAt = '2026-10-01T10:00:00.000Z'
  const at = (seconds: number) => Date.parse(startedAt) + seconds * 1000

  it('compte depuis l instant de depart pose par le serveur', () => {
    expect(restRemaining(60, startedAt, at(15.4))).toBe(45)
  })

  it('ne descend jamais sous zero', () => {
    expect(restRemaining(60, startedAt, at(90))).toBe(0)
  })

  it('une horloge locale en retard sur le serveur ne rallonge pas le repos', () => {
    expect(restRemaining(60, startedAt, at(-5))).toBe(60)
  })

  it('aucun repos en cours : rien a attendre', () => {
    expect(restRemaining(60, null, at(0))).toBe(0)
  })
})
