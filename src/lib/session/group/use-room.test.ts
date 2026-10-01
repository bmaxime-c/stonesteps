import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Room, RoomMember } from './model'
import { useRoom } from './use-room'

// Canal Supabase simule : on garde chaque abonnement pour pouvoir declencher
// a la main les evenements que le serveur Realtime enverrait.
type Handler = (payload: Record<string, unknown>) => void
type Listener = { type: string; filter: Record<string, unknown>; handler: Handler }

type FakeChannel = {
  name: string
  options: { config?: { presence?: { key?: string } } }
  listeners: Listener[]
  tracked: unknown[]
  presence: Record<string, unknown[]>
  subscribed: ((status: string) => void) | null
  emit: (type: string, match: Record<string, unknown>, payload?: object) => void
}

const fake = vi.hoisted(() => ({
  channels: [] as FakeChannel[],
  removed: [] as FakeChannel[],
  room: null as unknown,
  reads: 0,
}))

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    channel: (name: string, options: FakeChannel['options']) => {
      const channel: FakeChannel = {
        name,
        options,
        listeners: [],
        tracked: [],
        presence: {},
        subscribed: null,
        emit(type, match, payload = {}) {
          for (const listener of this.listeners) {
            const matches = Object.entries(match).every(
              ([key, value]) => listener.filter[key] === value,
            )
            if (listener.type === type && matches) listener.handler({ ...payload })
          }
        },
      }
      const api = {
        on(type: string, filter: Record<string, unknown>, handler: Handler) {
          channel.listeners.push({ type, filter, handler })
          return api
        },
        subscribe(callback: (status: string) => void) {
          channel.subscribed = callback
          return api
        },
        track: async (payload: unknown) => {
          channel.tracked.push(payload)
          return 'ok'
        },
        presenceState: () => channel.presence,
        __fake: channel,
      }
      fake.channels.push(channel)
      return api
    },
    removeChannel: async (api: { __fake: FakeChannel }) => {
      fake.removed.push(api.__fake)
      return 'ok'
    },
    from: () => {
      const builder = {
        select: () => builder,
        eq: () => builder,
        maybeSingle: async () => {
          fake.reads += 1
          return { data: fake.room, error: null }
        },
      }
      return builder
    },
  }),
}))

function member(userId: string, joinedAt: string): RoomMember {
  return {
    userId,
    displayName: userId.toUpperCase(),
    levelCeiling: 2,
    declaredCursor: -1,
    lastStatus: null,
    joinedAt,
  }
}

const initial: Room = {
  id: 'room-1',
  gridId: 'grid-1',
  gridVersionId: 'v1',
  hostId: 'a',
  levelId: null,
  status: 'open',
  cursor: 0,
  stage: 'set',
  restStartedAt: null,
  members: [member('a', '2026-10-01T10:00:00Z')],
}

// Ligne telle que PostgREST la rend : c'est ce que relit le hook.
function row(members: RoomMember[], status: Room['status'] = 'open') {
  return {
    id: 'room-1',
    grid_id: 'grid-1',
    grid_version_id: 'v1',
    host_id: 'a',
    level_id: null,
    status,
    cursor: 0,
    stage: 'set',
    rest_started_at: null,
    session_room_members: members.map((m) => ({
      user_id: m.userId,
      level_ceiling: m.levelCeiling,
      declared_cursor: m.declaredCursor,
      last_status: m.lastStatus,
      joined_at: m.joinedAt,
      profiles: { display_name: m.displayName },
    })),
  }
}

beforeEach(() => {
  fake.channels = []
  fake.removed = []
  fake.room = null
  fake.reads = 0
})

describe('useRoom', () => {
  it('part du salon rendu par le serveur', () => {
    const { result } = renderHook(() => useRoom(initial, 'a'))

    expect(result.current.room).toEqual(initial)
    expect(result.current.presentIds.size).toBe(0)
  })

  it('ouvre un canal par salon, presence indexee par utilisateur', () => {
    renderHook(() => useRoom(initial, 'a'))

    expect(fake.channels).toHaveLength(1)
    expect(fake.channels[0].name).toBe('room:room-1')
    expect(fake.channels[0].options.config?.presence?.key).toBe('a')
  })

  it('une entree, signalee par le salon, met a jour la liste', async () => {
    const { result } = renderHook(() => useRoom(initial, 'a'))
    fake.room = row([
      member('a', '2026-10-01T10:00:00Z'),
      member('b', '2026-10-01T10:01:00Z'),
    ])

    act(() => {
      // Le trigger touche roster_changed_at : l'evenement arrive par le salon.
      fake.channels[0].emit('postgres_changes', { table: 'session_rooms' })
    })

    await waitFor(() =>
      expect(result.current.room.members.map((m) => m.userId)).toEqual(['a', 'b']),
    )
  })

  it('une sortie, signalee par le salon, retire le membre', async () => {
    const { result } = renderHook(() => useRoom(initial, 'a'))
    fake.room = row([])

    act(() => {
      fake.channels[0].emit('postgres_changes', { table: 'session_rooms' })
    })

    await waitFor(() => expect(result.current.room.members).toEqual([]))
  })

  it('ne suit que son salon, et jamais la table des membres', () => {
    renderHook(() => useRoom(initial, 'a'))

    const filters = fake.channels[0].listeners
      .filter((listener) => listener.type === 'postgres_changes')
      .map((listener) => listener.filter)

    // Les suppressions de membres ne passent pas par la RLS : s'y abonner
    // ferait recevoir les sorties de tous les salons.
    expect(filters).toEqual([
      expect.objectContaining({ table: 'session_rooms', filter: 'id=eq.room-1' }),
    ])
  })

  it('un changement du salon relit son statut', async () => {
    const { result } = renderHook(() => useRoom(initial, 'a'))
    fake.room = row([member('a', '2026-10-01T10:00:00Z')], 'running')

    act(() => {
      fake.channels[0].emit('postgres_changes', { table: 'session_rooms' })
    })

    await waitFor(() => expect(result.current.room.status).toBe('running'))
  })

  it('se signale present une fois abonne', async () => {
    renderHook(() => useRoom(initial, 'a'))

    await act(async () => {
      fake.channels[0].subscribed?.('SUBSCRIBED')
    })

    expect(fake.channels[0].tracked).toHaveLength(1)
  })

  it('deux presences du meme utilisateur comptent pour une', () => {
    const { result } = renderHook(() => useRoom(initial, 'a'))

    act(() => {
      // Deux onglets du compte b : une cle, deux entrees.
      fake.channels[0].presence = {
        a: [{ presence_ref: '1' }],
        b: [{ presence_ref: '2' }, { presence_ref: '3' }],
      }
      fake.channels[0].emit('presence', { event: 'sync' })
    })

    expect([...result.current.presentIds].sort()).toEqual(['a', 'b'])
  })

  it('se desabonne au demontage', () => {
    const { unmount } = renderHook(() => useRoom(initial, 'a'))

    unmount()

    expect(fake.removed).toEqual([fake.channels[0]])
  })
})
