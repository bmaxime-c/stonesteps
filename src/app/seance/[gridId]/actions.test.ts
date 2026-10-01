import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Room } from '@/lib/session/group/model'
import type { ConsolidateInput } from '@/lib/session/model'

import { consolidateSession } from './actions'

// Client Supabase simule : chaque appel est consigne, et la reponse de chaque
// couple table / operation se regle test par test.
type Response = { data?: unknown; error?: { code?: string; message: string } | null }

const db = vi.hoisted(() => ({
  user: { id: 'me' } as { id: string } | null,
  responses: {} as Record<string, Response>,
  calls: [] as { table: string; op: string; values?: unknown; filters: unknown[] }[],
}))

const loaders = vi.hoisted(() => ({
  // Ce que rend la lecture du salon : null tant qu'on n'en est ni hote ni
  // membre, comme le veut la RLS.
  room: null as Room | null,
}))

vi.mock('server-only', () => ({}))

vi.mock('next/cache', () => ({ revalidatePath: () => {} }))

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => {
    function chain(key: string, call: (typeof db.calls)[number]) {
      const builder = {
        select: () => builder,
        single: () => builder,
        maybeSingle: () => builder,
        eq: (...args: unknown[]) => {
          call.filters.push(args)
          return builder
        },
        then: (
          resolve: (value: Response) => unknown,
          reject: (reason: unknown) => unknown,
        ) =>
          Promise.resolve({ data: null, error: null, ...db.responses[key] }).then(
            resolve,
            reject,
          ),
      }
      return builder
    }

    function record(table: string, op: string, values?: unknown) {
      const call = { table, op, values, filters: [] }
      db.calls.push(call)
      return chain(`${table}.${op}`, call)
    }

    return {
      auth: { getUser: async () => ({ data: { user: db.user } }) },
      from: (table: string) => ({
        select: () => record(table, 'select'),
        insert: (values: unknown) => record(table, 'insert', values),
        update: (values: unknown) => record(table, 'update', values),
        delete: () => record(table, 'delete'),
      }),
    }
  },
}))

vi.mock('@/lib/session/group/queries', () => ({
  loadRoom: async () => loaders.room,
}))

function input(overrides: Partial<ConsolidateInput> = {}): ConsolidateInput {
  return {
    gridId: 'g1',
    levelId: 'l2',
    gridName: 'Tractions',
    gridVersion: 2,
    levelNumber: 2,
    startedAt: '2026-10-01T10:00:00Z',
    validated: true,
    results: [
      {
        levelSetId: 's1',
        setIndex: 0,
        exerciseName: 'Tractions',
        setLabel: 'Série 1/1',
        unit: 'reps',
        targetValue: 5,
        actualValue: 6,
        status: 'surpass',
      },
    ],
    ...overrides,
  }
}

function room(overrides: Partial<Room> = {}): Room {
  return {
    id: 'r1',
    gridId: 'g1',
    gridVersionId: 'v2',
    hostId: 'host',
    levelId: 'l2',
    status: 'finished',
    cursor: 0,
    stage: 'finished',
    restStartedAt: null,
    members: [
      {
        userId: 'host',
        displayName: 'Camille',
        levelCeiling: 3,
        declaredCursor: 0,
        lastStatus: 'success',
        joinedAt: '2026-10-01T10:00:00Z',
      },
      {
        userId: 'me',
        displayName: 'Alex',
        levelCeiling: 2,
        declaredCursor: 0,
        lastStatus: 'surpass',
        joinedAt: '2026-10-01T10:01:00Z',
      },
    ],
    ...overrides,
  }
}

const sessionInsert = () =>
  db.calls.find((call) => call.table === 'sessions' && call.op === 'insert')

beforeEach(() => {
  db.user = { id: 'me' }
  db.calls = []
  db.responses = {
    'sessions.insert': { data: { id: 'sess1' } },
    'levels.select': { data: { position: 2, grid_version_id: 'v2' } },
  }
  loaders.room = room()
})

describe('consolidateSession, seance solo', () => {
  it('enregistre sans jamais lire de salon ni de niveau', async () => {
    loaders.room = null

    const outcome = await consolidateSession(input())

    expect(outcome).toEqual({ sessionId: 'sess1', error: null })
    expect(db.calls.map((call) => `${call.table}.${call.op}`)).toEqual([
      'sessions.insert',
      'session_sets.insert',
      'sessions.update',
    ])
    expect(sessionInsert()?.values).toMatchObject({
      owner_id: 'me',
      level_id: 'l2',
      level_number: 2,
    })
  })
})

describe('consolidateSession, seance de groupe', () => {
  it('enregistre un niveau du salon au plus au plafond du membre', async () => {
    const outcome = await consolidateSession(input({ roomId: 'r1' }))

    expect(outcome).toEqual({ sessionId: 'sess1', error: null })
    expect(sessionInsert()?.values).toMatchObject({
      owner_id: 'me',
      grid_id: 'g1',
      level_id: 'l2',
      level_number: 2,
    })
  })

  it('enregistre un niveau inferieur au plafond, sans effet sur lui', async () => {
    loaders.room = room({
      members: room().members.map((member) =>
        member.userId === 'me' ? { ...member, levelCeiling: 5 } : member,
      ),
    })

    const outcome = await consolidateSession(input({ roomId: 'r1' }))

    expect(outcome.error).toBeNull()
  })

  it('le numero de niveau vient du serveur, pas du client', async () => {
    await consolidateSession(input({ roomId: 'r1', levelNumber: 1 }))

    expect(sessionInsert()?.values).toMatchObject({ level_number: 2 })
  })

  it('refuse un niveau au-dessus du plafond du membre', async () => {
    db.responses['levels.select'] = { data: { position: 3, grid_version_id: 'v2' } }

    const outcome = await consolidateSession(input({ roomId: 'r1' }))

    expect(outcome).toEqual({
      sessionId: null,
      error: expect.stringContaining('dépasse ton niveau en cours'),
    })
    expect(sessionInsert()).toBeUndefined()
  })

  it('refuse un niveau qui n est pas celui du salon', async () => {
    const outcome = await consolidateSession(input({ roomId: 'r1', levelId: 'l1' }))

    expect(outcome).toEqual({
      sessionId: null,
      error: "Ce niveau n'est pas celui du salon.",
    })
    expect(sessionInsert()).toBeUndefined()
  })

  it('refuse une grille qui n est pas celle du salon', async () => {
    const outcome = await consolidateSession(input({ roomId: 'r1', gridId: 'g9' }))

    expect(outcome.sessionId).toBeNull()
    expect(sessionInsert()).toBeUndefined()
  })

  it('refuse qui ne fait pas partie du salon', async () => {
    loaders.room = room({ members: room().members.filter((m) => m.userId !== 'me') })

    const outcome = await consolidateSession(input({ roomId: 'r1' }))

    expect(outcome).toEqual({
      sessionId: null,
      error: 'Tu ne fais pas partie de ce salon.',
    })
    expect(sessionInsert()).toBeUndefined()
  })

  it('refuse un salon illisible, comme pour un non membre', async () => {
    loaders.room = null

    const outcome = await consolidateSession(input({ roomId: 'r1' }))

    expect(outcome.error).toBe('Tu ne fais pas partie de ce salon.')
    expect(sessionInsert()).toBeUndefined()
  })

  it('refuse si le niveau du salon a disparu', async () => {
    db.responses['levels.select'] = { data: null }

    const outcome = await consolidateSession(input({ roomId: 'r1' }))

    expect(outcome).toEqual({
      sessionId: null,
      error: "Ce niveau n'est pas celui du salon.",
    })
  })
})
