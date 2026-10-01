import { describe, expect, it } from 'vitest'

import type { SetResult } from '@/lib/session/model'

import type { Room, RoomMember } from './model'
import { memberStatuses, playerStage, playedResult, recordResult } from './run'

function result(setIndex: number, status: SetResult['status'] = 'success'): SetResult {
  return {
    levelSetId: `s${setIndex}`,
    setIndex,
    exerciseName: 'Pompes',
    setLabel: `Série ${setIndex + 1}/3`,
    unit: 'reps',
    targetValue: 10,
    actualValue: status === 'fail' ? 4 : 10,
    status,
  }
}

function member(userId: string, over: Partial<RoomMember> = {}): RoomMember {
  return {
    userId,
    displayName: userId.toUpperCase(),
    levelCeiling: 3,
    declaredCursor: -1,
    lastStatus: null,
    joinedAt: '2026-10-01T10:00:00Z',
    ...over,
  }
}

function room(over: Partial<Room> = {}): Room {
  return {
    id: 'r1',
    gridId: 'g1',
    gridVersionId: 'v1',
    hostId: 'a',
    levelId: 'l1',
    status: 'running',
    cursor: 1,
    stage: 'set',
    restStartedAt: null,
    members: [member('a'), member('b')],
    ...over,
  }
}

describe('playerStage', () => {
  it('joue la serie du curseur tant qu elle n est pas jouee', () => {
    expect(playerStage(room(), [result(0)])).toBe('set')
  })

  it('attend le groupe une fois la serie du curseur jouee', () => {
    expect(playerStage(room(), [result(0), result(1)])).toBe('waiting')
  })

  it('suit le repos du salon, jouee ou non', () => {
    expect(playerStage(room({ stage: 'rest' }), [result(0)])).toBe('rest')
  })

  it('passe au resume quand le salon est termine', () => {
    expect(playerStage(room({ status: 'finished', stage: 'finished' }), [])).toBe(
      'summary',
    )
  })
})

describe('recordResult', () => {
  it('ajoute une serie dans l ordre du niveau', () => {
    expect(recordResult([result(2)], result(0)).map((r) => r.setIndex)).toEqual([0, 2])
  })

  it('remplace la serie deja rangee au meme rang, sans doublon', () => {
    const corrected = recordResult([result(0), result(1)], result(1, 'fail'))

    expect(corrected).toHaveLength(2)
    expect(corrected[1].status).toBe('fail')
  })
})

describe('playedResult', () => {
  it('rend la serie du curseur si on l a jouee', () => {
    expect(playedResult([result(0), result(1)], 1)?.setIndex).toBe(1)
  })

  it('rien si la serie n a pas ete jouee', () => {
    // Une serie passee par le groupe sans nous ne se corrige pas : elle est
    // echouee, et c'est tout.
    expect(playedResult([result(0)], 1)).toBeNull()
  })
})

describe('memberStatuses', () => {
  it('ne montre que les autres, dans l ordre d arrivee', () => {
    const rows = memberStatuses(
      room({ members: [member('a'), member('b'), member('c')] }),
      new Set(['a', 'b']),
      'a',
    )

    expect(rows.map((row) => row.userId)).toEqual(['b', 'c'])
  })

  it('montre le statut declare pour la serie du curseur, jamais de valeur', () => {
    const rows = memberStatuses(
      room({
        members: [member('a'), member('b', { declaredCursor: 1, lastStatus: 'surpass' })],
      }),
      new Set(['b']),
      'a',
    )

    expect(rows).toEqual([
      { userId: 'b', name: 'B', present: true, declared: true, status: 'surpass' },
    ])
  })

  it('une declaration d une serie precedente ne compte pas pour celle-ci', () => {
    const rows = memberStatuses(
      room({
        members: [member('a'), member('b', { declaredCursor: 0, lastStatus: 'success' })],
      }),
      new Set(['b']),
      'a',
    )

    expect(rows[0]).toMatchObject({ declared: false, status: null })
  })

  it('signale un absent', () => {
    const rows = memberStatuses(room(), new Set(), 'a')

    expect(rows[0]).toMatchObject({ userId: 'b', present: false })
  })

  it('nomme un participant sans nom', () => {
    const rows = memberStatuses(
      room({ members: [member('a'), member('b', { displayName: null })] }),
      new Set(),
      'a',
    )

    expect(rows[0].name).toBe('Participant sans nom')
  })
})
