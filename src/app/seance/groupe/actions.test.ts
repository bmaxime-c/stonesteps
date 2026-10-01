import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Grid, GridVersion } from '@/lib/grids/model'
import type { Room } from '@/lib/session/group/model'
import type { LevelOutcome } from '@/lib/session/model'

import { createRoom, joinRoom, leaveRoom, startRoom } from './actions'

// Client Supabase simule : chaque ecriture est consignee, et la reponse de
// chaque couple table / operation se regle test par test.
type Response = { data?: unknown; error?: { code?: string; message: string } | null }

const db = vi.hoisted(() => ({
  user: { id: 'me' } as { id: string } | null,
  responses: {} as Record<string, Response>,
  writes: [] as { table: string; op: string; values?: unknown; filters: unknown[] }[],
  rpcs: [] as { fn: string; args: unknown }[],
}))

const loaders = vi.hoisted(() => ({
  grid: null as Grid | null,
  outcomes: [] as LevelOutcome[],
  room: null as Room | null,
}))

vi.mock('server-only', () => ({}))

vi.mock('@/lib/supabase/log', () => ({ logSupabaseError: () => {} }))

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => {
    function chain(key: string, write: (typeof db.writes)[number]) {
      const builder = {
        select: () => builder,
        single: () => builder,
        maybeSingle: () => builder,
        eq: (...args: unknown[]) => {
          write.filters.push(args)
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

    return {
      auth: { getUser: async () => ({ data: { user: db.user } }) },
      from: (table: string) => ({
        insert: (values: unknown) => {
          const write = { table, op: 'insert', values, filters: [] }
          db.writes.push(write)
          return chain(`${table}.insert`, write)
        },
        delete: () => {
          const write = { table, op: 'delete', filters: [] }
          db.writes.push(write)
          return chain(`${table}.delete`, write)
        },
      }),
      rpc: async (fn: string, args: unknown) => {
        db.rpcs.push({ fn, args })
        return { data: null, error: null, ...db.responses[`rpc.${fn}`] }
      },
    }
  },
}))

vi.mock('@/lib/grids/queries', () => ({ loadGrid: async () => loaders.grid }))

vi.mock('@/lib/session/queries', () => ({
  loadLevelOutcomes: async () => loaders.outcomes,
}))

vi.mock('@/lib/session/group/queries', () => ({ loadRoom: async () => loaders.room }))

function version(id: string, number: number): GridVersion {
  return {
    id,
    version: number,
    status: 'published',
    name: 'Tractions',
    accentColor: '#00FF87',
    restSeconds: 90,
    unchangedPrefix: 0,
    levels: [1, 2, 3].map((position) => ({
      id: `${id}-l${position}`,
      position,
      exercises: [],
    })),
  }
}

function grid(overrides: Partial<Grid> = {}): Grid {
  return {
    id: 'g1',
    ownerId: 'someone',
    ownerName: 'Camille',
    isPublic: true,
    deletedAt: null,
    owned: false,
    publishedVersions: [version('v1', 1), version('v2', 2)],
    draft: null,
    follow: { frozenAtVersion: null },
    followerCount: 1,
    ...overrides,
  }
}

function room(overrides: Partial<Room> = {}): Room {
  return {
    id: 'r1',
    gridId: 'g1',
    gridVersionId: 'v2',
    hostId: 'host',
    levelId: null,
    status: 'open',
    cursor: 0,
    stage: 'set',
    restStartedAt: null,
    members: [
      {
        userId: 'host',
        displayName: 'Camille',
        levelCeiling: 3,
        declaredCursor: -1,
        lastStatus: null,
        joinedAt: '2026-10-01T10:00:00Z',
      },
    ],
    ...overrides,
  }
}

const validated = (levelId: string): LevelOutcome => ({
  levelId,
  levelNumber: 1,
  validated: true,
  startedAt: '2026-09-01T10:00:00Z',
})

const inserts = (table: string) =>
  db.writes.filter((write) => write.table === table && write.op === 'insert')

beforeEach(() => {
  db.user = { id: 'me' }
  db.responses = {}
  db.writes = []
  db.rpcs = []
  loaders.grid = grid()
  loaders.outcomes = []
  loaders.room = room()
})

describe('rejoindre un salon', () => {
  it('refuse une version differente sans rien inserer', async () => {
    // Le suivi est fige sur la version 1 : le salon joue la 2.
    loaders.grid = grid({ follow: { frozenAtVersion: 1 } })

    const result = await joinRoom('r1')

    expect(result.refusal).toBe('version')
    expect(result.error).toMatch(/version/)
    expect(db.writes).toEqual([])
  })

  it('insere le plafond calcule cote serveur', async () => {
    loaders.outcomes = [validated('v2-l1')]

    const result = await joinRoom('r1')

    expect(result).toEqual({ error: null, refusal: null })
    expect(inserts('session_room_members').map((write) => write.values)).toEqual([
      { room_id: 'r1', user_id: 'me', level_ceiling: 2 },
    ])
  })

  it('insere le nombre de niveaux quand la grille est terminee', async () => {
    loaders.outcomes = ['v2-l1', 'v2-l2', 'v2-l3'].map(validated)

    await joinRoom('r1')

    expect(inserts('session_room_members')[0].values).toMatchObject({ level_ceiling: 3 })
  })

  it('laisse revenir un membre deja inscrit sans reinserer', async () => {
    loaders.room = room({
      status: 'running',
      members: [{ ...room().members[0], userId: 'me' }],
    })

    const result = await joinRoom('r1')

    expect(result).toEqual({ error: null, refusal: null })
    expect(db.writes).toEqual([])
  })

  it('distingue une grille qu on ne suit pas pour proposer l adoption', async () => {
    loaders.grid = grid({ follow: null })

    const result = await joinRoom('r1')

    expect(result.refusal).toBe('not_following')
    expect(result.error).toMatch(/Adopte/)
    expect(db.writes).toEqual([])
  })

  it('refuse un salon introuvable', async () => {
    loaders.room = null

    const result = await joinRoom('r1')

    expect(result.refusal).toBe('not_found')
    expect(db.writes).toEqual([])
  })

  it('traduit le refus du trigger pour un salon complet', async () => {
    db.responses['session_room_members.insert'] = {
      error: { code: 'P0001', message: 'room_full' },
    }

    const result = await joinRoom('r1')

    expect(result.refusal).toBe('full')
    expect(result.error).toBe('Le salon est complet : six participants au maximum.')
  })

  it('traduit le refus du trigger pour un salon deja lance', async () => {
    db.responses['session_room_members.insert'] = {
      error: { code: 'P0001', message: 'room_started' },
    }

    const result = await joinRoom('r1')

    expect(result.refusal).toBe('started')
    expect(result.error).toMatch(/déjà lancée/)
  })

  it('tient une double entree simultanee pour une entree reussie', async () => {
    // Deux onglets du meme compte : la cle primaire refuse le second, qui
    // n'a pourtant rien a signaler.
    db.responses['session_room_members.insert'] = {
      error: { code: '23505', message: 'duplicate key' },
    }

    expect(await joinRoom('r1')).toEqual({ error: null, refusal: null })
  })

  it('demande de se reconnecter sans session', async () => {
    db.user = null

    const result = await joinRoom('r1')

    expect(result.error).toMatch(/Reconnecte-toi/)
    expect(db.writes).toEqual([])
  })
})

describe('creer un salon', () => {
  it('ouvre le salon sur la version jouable et y inscrit l hote', async () => {
    loaders.outcomes = [validated('v2-l1'), validated('v2-l2')]
    db.responses['session_rooms.insert'] = { data: { id: 'new-room' } }

    const result = await createRoom('g1')

    expect(result).toEqual({ roomId: 'new-room', error: null })
    expect(inserts('session_rooms').map((write) => write.values)).toEqual([
      { grid_id: 'g1', grid_version_id: 'v2', host_id: 'me' },
    ])
    expect(inserts('session_room_members').map((write) => write.values)).toEqual([
      { room_id: 'new-room', user_id: 'me', level_ceiling: 3 },
    ])
  })

  it('ouvre sur la version ou le suivi est fige', async () => {
    loaders.grid = grid({ follow: { frozenAtVersion: 1 } })
    db.responses['session_rooms.insert'] = { data: { id: 'new-room' } }

    await createRoom('g1')

    expect(inserts('session_rooms')[0].values).toMatchObject({ grid_version_id: 'v1' })
  })

  it('refuse une grille qui n est pas chez l utilisateur', async () => {
    loaders.grid = grid({ follow: null })

    const result = await createRoom('g1')

    expect(result.roomId).toBeNull()
    expect(db.writes).toEqual([])
  })

  it('signale un salon qui n a pas pu etre cree', async () => {
    db.responses['session_rooms.insert'] = { error: { message: 'boom' } }

    const result = await createRoom('g1')

    expect(result.roomId).toBeNull()
    expect(result.error).toMatch(/salon/)
    expect(inserts('session_room_members')).toEqual([])
  })
})

describe('quitter un salon', () => {
  it('retire sa propre ligne', async () => {
    db.responses['session_room_members.delete'] = { data: [{ room_id: 'r1' }] }

    const result = await leaveRoom('r1')

    expect(result).toEqual({ error: null })
    expect(db.writes).toEqual([
      {
        table: 'session_room_members',
        op: 'delete',
        filters: [
          ['room_id', 'r1'],
          ['user_id', 'me'],
        ],
      },
    ])
  })

  it('refuse de quitter un salon deja lance', async () => {
    // La RLS ne laisse rien supprimer : la suppression ne rend aucune ligne.
    db.responses['session_room_members.delete'] = { data: [] }

    const result = await leaveRoom('r1')

    expect(result.error).toMatch(/lancée/)
  })
})

describe('lancer un salon', () => {
  it('passe par start_room', async () => {
    const result = await startRoom('r1', 'v2-l2')

    expect(result).toEqual({ error: null })
    expect(db.rpcs).toEqual([
      { fn: 'start_room', args: { p_room: 'r1', p_level: 'v2-l2' } },
    ])
  })

  it('traduit un niveau au-dessus du plafond', async () => {
    db.responses['rpc.start_room'] = {
      error: { code: 'P0001', message: 'level_above_ceiling' },
    }

    const result = await startRoom('r1', 'v2-l3')

    expect(result.error).toMatch(/plafond/)
  })

  it('traduit un lancement par un autre que l hote', async () => {
    db.responses['rpc.start_room'] = {
      error: { code: 'P0001', message: 'not_room_host' },
    }

    const result = await startRoom('r1', 'v2-l1')

    expect(result.error).toBe("Seul l'hôte peut lancer la séance.")
  })
})
