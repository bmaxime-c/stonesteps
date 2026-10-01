import { act, render, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Grid, GridVersion, Level } from '@/lib/grids/model'
import type { LevelOutcome } from '@/lib/session/model'

import RoomPage from './[roomId]/page'
import { createRoom, startRoom } from './actions'

/**
 * Test d'acceptation de la tranche « salon » : de l'ouverture au lancement.
 *
 * Tout est reel — page, actions, regles du salon, suivi en direct, ecrans —
 * sauf la frontiere Supabase. Une base en memoire tient les salons et leurs
 * membres, rejoue ce que tiennent le trigger d'entree et start_room, et
 * pousse les evenements Realtime aux canaux ouverts, comme le ferait le
 * serveur.
 */

type Handler = (payload: Record<string, unknown>) => void
type Listener = { type: string; filter: Record<string, unknown>; handler: Handler }
type Channel = { name: string; listeners: Listener[] }

type RoomRecord = {
  id: string
  grid_id: string
  grid_version_id: string
  host_id: string
  level_id: string | null
  status: 'open' | 'running' | 'finished'
  cursor: number
}

type MemberRecord = {
  room_id: string
  user_id: string
  level_ceiling: number
  joined_at: string
}

const world = vi.hoisted(() => {
  const state = {
    user: null as string | null,
    names: {} as Record<string, string>,
    grids: {} as Record<string, unknown>,
    outcomes: {} as Record<string, unknown[]>,
    /** Niveau -> version et position, pour que start_room verifie le niveau. */
    levels: {} as Record<string, { versionId: string; position: number }>,
    rooms: [] as RoomRecord[],
    members: [] as MemberRecord[],
    channels: [] as Channel[],
    presence: {} as Record<string, Set<string>>,
    clock: 0,
  }

  /** Ce que le serveur Realtime enverrait aux abonnes du salon. */
  function broadcast(roomId: string, table: string, event: string) {
    for (const channel of state.channels) {
      if (channel.name !== `room:${roomId}`) continue
      for (const listener of channel.listeners) {
        const filter = listener.filter
        if (listener.type !== 'postgres_changes' || filter.table !== table) continue
        if (filter.event !== '*' && filter.event !== event) continue
        listener.handler({ new: { room_id: roomId, id: roomId }, old: {} })
      }
    }
  }

  function syncPresence(roomId: string) {
    for (const channel of state.channels) {
      if (channel.name !== `room:${roomId}`) continue
      for (const listener of channel.listeners) {
        if (listener.type === 'presence') listener.handler({})
      }
    }
  }

  /** Ligne telle que PostgREST la rend, membres et noms compris. */
  function roomRow(roomId: string) {
    const room = state.rooms.find((candidate) => candidate.id === roomId)
    if (!room) return null
    return {
      ...room,
      stage: 'set',
      rest_started_at: null,
      session_room_members: state.members
        .filter((member) => member.room_id === roomId)
        .map((member) => ({
          user_id: member.user_id,
          level_ceiling: member.level_ceiling,
          declared_cursor: -1,
          last_status: null,
          joined_at: member.joined_at,
          profiles: { display_name: state.names[member.user_id] ?? null },
        })),
    }
  }

  type DbError = { code: string; message: string }
  type Result = { data: unknown; error: DbError | null }

  /** Trigger d'entree : salon ouvert, six places, une ligne par compte. */
  function insertMember(values: Omit<MemberRecord, 'joined_at'>): Result {
    const room = state.rooms.find((candidate) => candidate.id === values.room_id)
    const members = state.members.filter((member) => member.room_id === values.room_id)
    const raise = (message: string) => ({
      data: null,
      error: { code: 'P0001', message },
    })

    if (!room) return raise('room_not_found')
    if (members.some((member) => member.user_id === values.user_id)) {
      return { data: null, error: { code: '23505', message: 'duplicate key' } }
    }
    if (room.status !== 'open') return raise('room_started')
    if (members.length >= 6) return raise('room_full')

    state.clock += 1
    state.members.push({
      ...values,
      joined_at: `2026-10-01T10:${String(state.clock).padStart(2, '0')}:00Z`,
    })
    broadcast(values.room_id, 'session_room_members', 'INSERT')
    return { data: null, error: null }
  }

  function insertRoom(values: Omit<RoomRecord, 'id' | 'level_id' | 'status' | 'cursor'>) {
    const id = `room-${state.rooms.length + 1}`
    state.rooms.push({ ...values, id, level_id: null, status: 'open', cursor: 0 })
    return { data: { id }, error: null }
  }

  /** start_room : hote, salon ouvert, niveau de la version figee, plafond. */
  function startRoom(roomId: string, levelId: string): Result {
    const room = state.rooms.find((candidate) => candidate.id === roomId)
    const raise = (message: string) => ({
      data: null,
      error: { code: 'P0001', message },
    })
    if (!room) return raise('room_not_found')
    if (room.host_id !== state.user) return raise('not_room_host')
    if (room.status !== 'open') return raise('room_started')

    const level = state.levels[levelId]
    if (!level || level.versionId !== room.grid_version_id) {
      return raise('level_not_in_room')
    }
    const ceiling = Math.min(
      ...state.members
        .filter((member) => member.room_id === roomId)
        .map((member) => member.level_ceiling),
    )
    if (level.position > ceiling) return raise('level_above_ceiling')

    Object.assign(room, { status: 'running', level_id: levelId, cursor: 0 })
    broadcast(roomId, 'session_rooms', 'UPDATE')
    return { data: null, error: null }
  }

  /** Requete chainee, resolue a la fin comme un builder PostgREST. */
  function query(run: () => Result) {
    const builder = {
      select: () => builder,
      single: () => builder,
      eq: () => builder,
      maybeSingle: async () => run(),
      then: (resolve: (value: Result) => unknown, reject: (reason: unknown) => unknown) =>
        Promise.resolve().then(run).then(resolve, reject),
    }
    return builder
  }

  function client() {
    return {
      auth: {
        getUser: async () => ({
          data: { user: state.user ? { id: state.user } : null },
        }),
      },
      from: (table: string) => ({
        // Seule lecture de la tranche : le salon par son identifiant.
        select: () => {
          let roomId = ''
          const builder = {
            eq: (_column: string, value: string) => {
              roomId = value
              return builder
            },
            maybeSingle: async () => ({ data: roomRow(roomId), error: null }),
          }
          return builder
        },
        insert: (values: never) => {
          // Ecriture immediate : un builder PostgREST l'enverrait au premier await.
          const result =
            table === 'session_rooms' ? insertRoom(values) : insertMember(values)
          return query(() => result)
        },
      }),
      rpc: async (fn: string, args: { p_room: string; p_level: string }) =>
        fn === 'start_room'
          ? startRoom(args.p_room, args.p_level)
          : { data: null, error: { code: '42883', message: 'unknown function' } },
    }
  }

  /** Client navigateur : memes lectures, plus les canaux Realtime. */
  function browserClient() {
    return {
      ...client(),
      channel: (name: string, options: { config: { presence: { key: string } } }) => {
        const channel: Channel = { name, listeners: [] }
        state.channels.push(channel)
        const roomId = name.slice('room:'.length)
        const api = {
          on: (type: string, filter: Record<string, unknown>, handler: Handler) => {
            channel.listeners.push({ type, filter, handler })
            return api
          },
          subscribe: (callback: (status: string) => void) => {
            queueMicrotask(() => callback('SUBSCRIBED'))
            return api
          },
          track: async () => {
            state.presence[roomId] ??= new Set()
            state.presence[roomId].add(options.config.presence.key)
            syncPresence(roomId)
            return 'ok'
          },
          presenceState: () =>
            Object.fromEntries(
              [...(state.presence[roomId] ?? [])].map((key) => [key, [{}]]),
            ),
          __channel: channel,
        }
        return api
      },
      removeChannel: async (api: { __channel: Channel }) => {
        state.channels = state.channels.filter((channel) => channel !== api.__channel)
        return 'ok'
      },
    }
  }

  return { state, client, browserClient }
})

vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/log', () => ({ logSupabaseError: () => {} }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => world.client() }))
vi.mock('@/lib/supabase/client', () => ({ createClient: () => world.browserClient() }))

// Lectures de grille et d'historique : ce que la RLS rendrait a l'utilisateur
// courant. Les calculs de progression qui s'en servent restent reels.
vi.mock('@/lib/grids/queries', () => ({
  loadGrid: async () => world.state.grids[world.state.user ?? ''] ?? null,
}))
vi.mock('@/lib/session/queries', () => ({
  loadLevelOutcomes: async () => world.state.outcomes[world.state.user ?? ''] ?? [],
}))
vi.mock('@/lib/account/queries', () => ({
  loadTimerCues: async () => ({
    sound: false,
    blink: false,
    flash: false,
    warningPercent: 15,
  }),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  redirect: (url: string) => {
    throw new Error(`redirect inattendu vers ${url}`)
  },
}))

vi.mock('@/app/(app)/grilles/actions', () => ({
  followGrid: vi.fn(),
  unfollowGrid: vi.fn(),
  duplicateGrid: vi.fn(),
}))

const EXERCISES = ['Pompes', 'Tractions', 'Dips', 'Muscle-up']

function level(versionId: string, position: number): Level {
  return {
    id: `${versionId}-l${position}`,
    position,
    exercises: [
      {
        id: `${versionId}-e${position}`,
        exerciseId: `x${position}`,
        exerciseName: EXERCISES[position - 1],
        imageUrl: null,
        position: 1,
        sets: [1, 2].map((setPosition) => ({
          id: `${versionId}-s${position}-${setPosition}`,
          position: setPosition,
          targetReps: position * 10,
          timerMode: 'none' as const,
          timerSeconds: null,
        })),
      },
    ],
  }
}

function version(id: string, number: number): GridVersion {
  return {
    id,
    version: number,
    status: 'published',
    name: 'Haut du corps',
    accentColor: '#00FF87',
    restSeconds: 60,
    unchangedPrefix: 0,
    levels: [1, 2, 3, 4].map((position) => level(id, position)),
  }
}

const VERSIONS = [version('v1', 1), version('v2', 2)]

/** La grille vue par un utilisateur : creee, suivie, ou suivie et figee en v1. */
function gridFor(kind: 'owner' | 'follower' | 'frozen'): Grid {
  return {
    id: 'g1',
    ownerId: 'alice',
    ownerName: 'Alice',
    isPublic: true,
    deletedAt: null,
    owned: kind === 'owner',
    publishedVersions: VERSIONS,
    draft: null,
    follow: kind === 'owner' ? null : { frozenAtVersion: kind === 'frozen' ? 1 : null },
    followerCount: 0,
  }
}

/** Historique : les niveaux deja valides, sur la version 2. */
function validatedUpTo(position: number): LevelOutcome[] {
  return Array.from({ length: position }, (_, index) => ({
    levelId: `v2-l${index + 1}`,
    levelNumber: index + 1,
    validated: true,
    startedAt: '2026-09-01T10:00:00Z',
  }))
}

function player(
  id: string,
  name: string,
  kind: 'owner' | 'follower' | 'frozen',
  validated: number,
) {
  world.state.names[id] = name
  world.state.grids[id] = gridFor(kind)
  world.state.outcomes[id] = validatedUpTo(validated)
}

/**
 * Ouvre le lien du salon en tant que `userId`, comme le ferait le navigateur.
 *
 * Sous act : l'entree pousse des evenements Realtime, et les salons deja
 * affiches se relisent dans la foulee.
 */
async function openLink(userId: string, roomId: string) {
  world.state.user = userId
  let view: ReturnType<typeof render> | undefined
  await act(async () => {
    const page = await RoomPage({
      params: Promise.resolve({ roomId }),
    } as PageProps<'/seance/groupe/[roomId]'>)
    view = render(page)
  })
  return within(view!.container)
}

beforeEach(() => {
  Object.assign(world.state, {
    user: null,
    names: {},
    grids: {},
    outcomes: {},
    levels: Object.fromEntries(
      VERSIONS.flatMap((candidate) =>
        candidate.levels.map((entry) => [
          entry.id,
          { versionId: candidate.id, position: entry.position },
        ]),
      ),
    ),
    rooms: [],
    members: [],
    channels: [],
    presence: {},
    clock: 0,
  })

  // Alice en est au niveau 4, Bruno au 2. Camille suit une copie figee en v1.
  player('alice', 'Alice', 'owner', 3)
  player('bruno', 'Bruno', 'follower', 1)
  player('camille', 'Camille', 'frozen', 3)
  for (const name of ['Dora', 'Elio', 'Fanny', 'Gael', 'Hugo']) {
    player(name.toLowerCase(), name, 'follower', 3)
  }
})

describe('Salon a plusieurs, de l ouverture au lancement', () => {
  it('ouvre, accueille, refuse, puis lance tout le salon sur la serie 1', async () => {
    // A ouvre un salon : il en est l'hote et le premier membre.
    world.state.user = 'alice'
    const created = await createRoom('g1')
    expect(created.error).toBeNull()
    const roomId = created.roomId!

    const alice = await openLink('alice', roomId)
    expect(await alice.findByRole('listitem', { name: /Alice/ })).toBeInTheDocument()
    // Seule, Alice peut choisir jusqu'a son niveau en cours.
    expect(alice.getByRole('button', { name: 'Niveau 4' })).toBeInTheDocument()

    // B ouvre le lien : il entre, et le plafond descend a son niveau.
    const bruno = await openLink('bruno', roomId)
    expect(bruno.getByRole('listitem', { name: /Bruno/ })).toBeInTheDocument()
    expect(await alice.findByRole('listitem', { name: /Bruno/ })).toBeInTheDocument()
    await waitFor(() =>
      expect(alice.queryByRole('button', { name: 'Niveau 3' })).not.toBeInTheDocument(),
    )
    expect(alice.getByRole('button', { name: 'Niveau 2' })).toBeInTheDocument()
    expect(bruno.getByText(/jusqu.au niveau 2/)).toBeInTheDocument()

    // C joue une autre version : la porte reste fermee, avec le motif.
    const camille = await openLink('camille', roomId)
    expect(
      camille.getByText(/Ta version de cette grille n'est pas celle du salon/),
    ).toBeInTheDocument()
    expect(camille.queryByRole('list')).not.toBeInTheDocument()

    // Quatre de plus remplissent les six places ; le septieme est refuse.
    for (const id of ['dora', 'elio', 'fanny', 'gael']) await openLink(id, roomId)
    expect(await alice.findByText(/Participants · 6\/6/)).toBeInTheDocument()

    const hugo = await openLink('hugo', roomId)
    expect(hugo.getByText(/Le salon est complet/)).toBeInTheDocument()
    expect(
      world.state.members.filter((member) => member.room_id === roomId),
    ).toHaveLength(6)

    // A lance au niveau permis : tout le salon bascule sur la premiere serie.
    world.state.user = 'alice'
    await userEvent.click(alice.getByRole('button', { name: 'Niveau 2' }))
    await userEvent.click(alice.getByRole('button', { name: 'Lancer le niveau 2' }))

    for (const view of [alice, bruno]) {
      expect(await view.findByText('Niveau 2/4')).toBeInTheDocument()
      expect(view.getByText('Tractions')).toBeInTheDocument()
      expect(view.getByText(/Série 1\/2/)).toBeInTheDocument()
      expect(view.getByText('objectif 20 reps')).toBeInTheDocument()
      expect(view.getByRole('button', { name: 'Valider la série' })).toBeInTheDocument()
    }
    expect(world.state.rooms[0]).toMatchObject({ status: 'running', level_id: 'v2-l2' })
  })

  it('refuse au lancement un niveau au-dessus du plafond', async () => {
    world.state.user = 'alice'
    const { roomId } = await createRoom('g1')
    world.state.user = 'bruno'
    await openLink('bruno', roomId!)

    // L'interface ne le propose pas ; la base le refuse quand meme.
    world.state.user = 'alice'
    const result = await startRoom(roomId!, 'v2-l4')

    expect(result.error).toMatch(/dépasse le plafond du salon/)
    expect(world.state.rooms[0].status).toBe('open')
  })
})
