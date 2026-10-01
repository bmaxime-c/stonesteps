/**
 * Base Supabase en memoire, pour les tests d'acceptation du salon.
 *
 * Module de test, jamais importe par l'application. Il tient les salons, leurs
 * membres et les seances enregistrees, rejoue ce que tiennent la RLS, les
 * triggers d'entree et de depart, et les fonctions create_room, start_room,
 * declare_set, advance_room, heartbeat_room et claim_room_host, et pousse les
 * evenements Realtime aux canaux ouverts, comme le ferait le serveur. Tout le reste -- pages, actions, regles, ecrans -- reste reel.
 *
 * A charger dans vi.hoisted : les mocks de module s'y referent.
 */

import type { Grid, GridVersion, Level } from '@/lib/grids/model'
import type { LevelOutcome } from '@/lib/session/model'

type Handler = (payload: Record<string, unknown>) => void
type Listener = { type: string; filter: Record<string, unknown>; handler: Handler }
type Channel = { name: string; listeners: Listener[] }

type SetStatus = 'success' | 'surpass' | 'fail'

export type RoomRecord = {
  id: string
  grid_id: string
  grid_version_id: string
  host_id: string
  level_id: string | null
  status: 'open' | 'running' | 'finished'
  cursor: number
  stage: 'set' | 'rest' | 'finished'
  rest_started_at: string | null
  host_seen_at: string
  /** Opaque ici : seul compte qu'il change a chaque mouvement de la liste. */
  roster_changed_at: string
}

export type MemberRecord = {
  room_id: string
  user_id: string
  level_ceiling: number
  declared_cursor: number
  last_status: SetStatus | null
  joined_at: string
}

export type SessionRow = {
  id: string
  owner_id: string
  grid_id: string
  level_id: string
  level_number: number
  started_at: string
  validated: boolean
  completed_at: string | null
}

export type SessionSetRow = {
  session_id: string
  set_index: number
  actual_value: number
  status: SetStatus
}

type DbError = { code: string; message: string }
type Result = { data: unknown; error: DbError | null }

export function createRoomWorld() {
  const state = {
    user: null as string | null,
    names: {} as Record<string, string>,
    grids: {} as Record<string, unknown>,
    /** Historique de depart, par utilisateur. */
    outcomes: {} as Record<string, LevelOutcome[]>,
    /** Niveau -> version, position et nombre de series. */
    levels: {} as Record<
      string,
      { versionId: string; position: number; setCount: number }
    >,
    /** Repos de chaque version, en secondes. */
    restSeconds: {} as Record<string, number>,
    rooms: [] as RoomRecord[],
    members: [] as MemberRecord[],
    sessions: [] as SessionRow[],
    sessionSets: [] as SessionSetRow[],
    channels: [] as Channel[],
    presence: {} as Record<string, Set<string>>,
    clock: 0,
    /** Mouvements de la liste des membres, pour roster_changed_at. */
    roster: 0,
  }

  function reset() {
    Object.assign(state, {
      user: null,
      names: {},
      grids: {},
      outcomes: {},
      levels: {},
      restSeconds: {},
      rooms: [],
      members: [],
      sessions: [],
      sessionSets: [],
      channels: [],
      presence: {},
      clock: 0,
      roster: 0,
    })
  }

  const raise = (message: string): Result => ({
    data: null,
    error: { code: 'P0001', message },
  })

  const findRoom = (roomId: string) =>
    state.rooms.find((candidate) => candidate.id === roomId)
  const roomMembers = (roomId: string) =>
    state.members.filter((member) => member.room_id === roomId)

  /** Le trigger touch_room_roster : la liste a bouge. */
  function touchRoster(room: RoomRecord) {
    state.roster += 1
    room.roster_changed_at = `roster-${state.roster}`
  }

  const now = () => new Date().toISOString()

  /**
   * Ce que le serveur Realtime enverrait aux abonnes du salon : la ligne du
   * salon telle qu'elle est apres la modification, sans les membres.
   */
  function broadcast(roomId: string) {
    const room = findRoom(roomId)
    for (const channel of state.channels) {
      if (channel.name !== `room:${roomId}`) continue
      for (const listener of channel.listeners) {
        const filter = listener.filter
        if (listener.type !== 'postgres_changes' || filter.table !== 'session_rooms') {
          continue
        }
        listener.handler({ eventType: 'UPDATE', new: room ? { ...room } : {}, old: {} })
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

  /** Ligne telle que PostgREST la rend. RLS : hote et membres seulement. */
  function roomRow(roomId: string) {
    const room = findRoom(roomId)
    if (!room) return null
    const insider =
      room.host_id === state.user ||
      roomMembers(roomId).some((member) => member.user_id === state.user)
    if (!insider) return null
    return {
      ...room,
      session_room_members: roomMembers(roomId).map((member) => ({
        user_id: member.user_id,
        level_ceiling: member.level_ceiling,
        declared_cursor: member.declared_cursor,
        last_status: member.last_status,
        joined_at: member.joined_at,
        profiles: { display_name: state.names[member.user_id] ?? null },
      })),
    }
  }

  /** Niveau tel que le lit la consolidation : position, version, series. */
  function levelRow(levelId: string) {
    const level = state.levels[levelId]
    if (!level) return null
    return {
      position: level.position,
      grid_version_id: level.versionId,
      level_exercises: [
        {
          level_sets: Array.from({ length: level.setCount }, (_, index) => ({
            id: `${levelId}-set${index}`,
          })),
        },
      ],
    }
  }

  /** Trigger d'entree : salon ouvert, six places, une ligne par compte. */
  function insertMember(values: {
    room_id: string
    user_id: string
    level_ceiling: number
  }) {
    const room = findRoom(values.room_id)
    const members = roomMembers(values.room_id)

    if (!room) return raise('room_not_found')
    if (members.some((member) => member.user_id === values.user_id)) {
      return { data: null, error: { code: '23505', message: 'duplicate key' } }
    }
    if (room.status !== 'open') return raise('room_started')
    if (members.length >= 6) return raise('room_full')

    state.clock += 1
    state.members.push({
      ...values,
      declared_cursor: -1,
      last_status: null,
      joined_at: `2026-10-01T10:${String(state.clock).padStart(2, '0')}:00Z`,
    })
    touchRoster(room)
    // Le trigger touche le salon : c'est par lui que l'entree se propage.
    broadcast(values.room_id)
    return { data: null, error: null }
  }

  /**
   * create_room : salon et inscription de l'hote d'un seul tenant. La grille
   * doit etre chez l'appelant, sur la version demandee.
   */
  function createRoom(args: { p_grid: string; p_version: string; p_ceiling: number }) {
    const grid = state.grids[state.user ?? ''] as
      { id: string; publishedVersions: { id: string }[] } | undefined
    if (
      !state.user ||
      grid?.id !== args.p_grid ||
      !grid.publishedVersions.some((candidate) => candidate.id === args.p_version)
    ) {
      return raise('grid_not_playable')
    }

    const id = `room-${state.rooms.length + 1}`
    state.rooms.push({
      id,
      grid_id: args.p_grid,
      grid_version_id: args.p_version,
      host_id: state.user,
      level_id: null,
      status: 'open',
      cursor: 0,
      stage: 'set',
      rest_started_at: null,
      host_seen_at: now(),
      roster_changed_at: 'roster-0',
    })
    insertMember({ room_id: id, user_id: state.user, level_ceiling: args.p_ceiling })
    return { data: id, error: null }
  }

  /**
   * Sortie d'un membre : sa propre ligne, salon ouvert (RLS). Puis le trigger
   * de passation : l'hote qui part laisse la main au plus ancien restant, et
   * un salon vide disparait.
   */
  function deleteMember(filters: Record<string, unknown>): Result {
    const room = findRoom(String(filters.room_id))
    const userId = String(filters.user_id)
    const leaving = state.members.find(
      (member) => member.room_id === room?.id && member.user_id === userId,
    )
    if (!room || !leaving || userId !== state.user || room.status !== 'open') {
      return { data: [], error: null }
    }

    state.members = state.members.filter((member) => member !== leaving)
    if (room.host_id === userId) {
      const next = roomMembers(room.id).sort(
        (a, b) =>
          a.joined_at.localeCompare(b.joined_at) || a.user_id.localeCompare(b.user_id),
      )[0]
      if (!next) {
        state.rooms = state.rooms.filter((candidate) => candidate !== room)
        broadcast(room.id)
        return { data: [{ room_id: room.id }], error: null }
      }
      Object.assign(room, { host_id: next.user_id, host_seen_at: now() })
    }
    touchRoster(room)
    broadcast(room.id)
    return { data: [{ room_id: room.id }], error: null }
  }

  /** heartbeat_room : l'hote seul, salon ouvert ou lance. */
  function heartbeatRoom(roomId: string): Result {
    const room = findRoom(roomId)
    if (
      !room ||
      room.host_id !== state.user ||
      (room.status !== 'open' && room.status !== 'running')
    ) {
      return raise('not_room_host')
    }
    room.host_seen_at = now()
    broadcast(roomId)
    return { data: null, error: null }
  }

  /**
   * claim_room_host : un membre prend la place d'un hote silencieux depuis
   * plus de 15 s. Les appels se suivent un a un, comme sous le verrou du
   * salon : le second candidat trouve un hote tout frais.
   */
  function claimRoomHost(roomId: string): Result {
    const room = findRoom(roomId)
    const member = roomMembers(roomId).some((m) => m.user_id === state.user)
    if (!room || !member || !state.user) return raise('not_room_member')
    if (room.status !== 'open' && room.status !== 'running') {
      return raise('room_finished')
    }
    if (room.host_id !== state.user) {
      if (Date.now() - Date.parse(room.host_seen_at) <= 15_000) {
        return raise('host_alive')
      }
      room.host_id = state.user
    }
    room.host_seen_at = now()
    broadcast(roomId)
    return { data: null, error: null }
  }

  function insertSession(values: Omit<SessionRow, 'id' | 'completed_at'>): Result {
    const id = `sess-${state.sessions.length + 1}`
    state.sessions.push({ ...values, id, completed_at: null })
    return { data: { id }, error: null }
  }

  function insertSessionSets(values: SessionSetRow[]): Result {
    state.sessionSets.push(...values)
    return { data: null, error: null }
  }

  /** start_room : hote, salon ouvert, niveau de la version figee, plafond. */
  function startRoom(roomId: string, levelId: string): Result {
    const room = findRoom(roomId)
    if (!room) return raise('room_not_found')
    if (room.host_id !== state.user) return raise('not_room_host')
    if (!roomMembers(roomId).some((member) => member.user_id === state.user)) {
      return raise('host_not_in_room')
    }
    if (room.status !== 'open') return raise('room_started')

    const level = state.levels[levelId]
    if (!level || level.versionId !== room.grid_version_id) {
      return raise('level_not_in_room')
    }
    const ceiling = Math.min(...roomMembers(roomId).map((member) => member.level_ceiling))
    if (level.position > ceiling) return raise('level_above_ceiling')

    Object.assign(room, {
      status: 'running',
      level_id: levelId,
      cursor: 0,
      stage: 'set',
      host_seen_at: now(),
    })
    broadcast(roomId)
    return { data: null, error: null }
  }

  /** declare_set : membre, salon lance, serie du curseur seulement. */
  function declareSet(roomId: string, cursor: number, status: SetStatus): Result {
    const room = findRoom(roomId)
    const member = roomMembers(roomId).find(
      (candidate) => candidate.user_id === state.user,
    )
    if (!room || !member) return raise('not_room_member')
    if (room.status !== 'running') return raise('room_not_running')
    if (cursor !== room.cursor) return raise('stale_cursor')

    Object.assign(member, { declared_cursor: cursor, last_status: status })
    touchRoster(room)
    // Le trigger touch_room_roster reveille les abonnes du salon.
    broadcast(roomId)
    return { data: null, error: null }
  }

  /** advance_room : hote, concurrence optimiste, attente des presents. */
  function advanceRoom(args: {
    p_room: string
    p_expected_cursor: number
    p_expected_stage: RoomRecord['stage']
    p_present: string[]
    p_force?: boolean
  }): Result {
    const room = findRoom(args.p_room)
    if (!room || room.host_id !== state.user) return raise('not_room_host')
    if (room.status !== 'running') return raise('room_not_running')
    if (room.cursor !== args.p_expected_cursor || room.stage !== args.p_expected_stage) {
      return raise('room_moved')
    }

    const waiting = roomMembers(room.id).some(
      (member) =>
        args.p_present.includes(member.user_id) && member.declared_cursor < room.cursor,
    )
    if (room.stage === 'set' && !args.p_force && waiting) return raise('room_waiting')

    const total = state.levels[room.level_id ?? '']?.setCount ?? 0
    const rest = state.restSeconds[room.grid_version_id] ?? 0

    if (room.stage === 'rest') {
      Object.assign(room, {
        cursor: room.cursor + 1,
        stage: 'set',
        rest_started_at: null,
      })
    } else if (room.cursor >= total - 1) {
      Object.assign(room, {
        status: 'finished',
        stage: 'finished',
        rest_started_at: null,
      })
    } else if (rest > 0) {
      Object.assign(room, { stage: 'rest', rest_started_at: new Date().toISOString() })
    } else {
      Object.assign(room, {
        cursor: room.cursor + 1,
        stage: 'set',
        rest_started_at: null,
      })
    }
    broadcast(room.id)
    return { data: null, error: null }
  }

  /** room_entry : la porte, ouverte a qui connait l'identifiant. */
  function roomEntry(roomId: string): Result {
    const room = findRoom(roomId)
    return {
      data: room
        ? {
            grid_id: room.grid_id,
            grid_version_id: room.grid_version_id,
            status: room.status,
          }
        : null,
      error: null,
    }
  }

  /**
   * Requete chainee, resolue a l'attente comme un builder PostgREST. Les
   * filtres `eq` sont transmis a `run`.
   */
  function query(run: (filters: Record<string, unknown>) => Result) {
    const filters: Record<string, unknown> = {}
    const builder = {
      select: () => builder,
      single: () => builder,
      maybeSingle: () => builder,
      eq: (column: string, value: unknown) => {
        filters[column] = value
        return builder
      },
      then: (resolve: (value: Result) => unknown, reject: (reason: unknown) => unknown) =>
        Promise.resolve()
          .then(() => run(filters))
          .then(resolve, reject),
    }
    return builder
  }

  function select(table: string) {
    return query((filters) => {
      const id = String(filters.id ?? '')
      if (table === 'session_rooms') return { data: roomRow(id), error: null }
      if (table === 'levels') return { data: levelRow(id), error: null }
      return { data: null, error: null }
    })
  }

  function insert(table: string, values: never) {
    // Ecriture immediate : un builder PostgREST l'enverrait au premier await.
    // Pas d'insertion directe de salon : la policy n'existe plus, tout passe
    // par create_room.
    const result =
      table === 'session_rooms'
        ? raise('new row violates row-level security policy')
        : table === 'session_room_members'
          ? insertMember(values)
          : table === 'sessions'
            ? insertSession(values)
            : insertSessionSets(values)
    return query(() => result)
  }

  function update(table: string, values: Partial<SessionRow>) {
    return query((filters) => {
      if (table === 'sessions') {
        const session = state.sessions.find((candidate) => candidate.id === filters.id)
        if (session) Object.assign(session, values)
      }
      return { data: null, error: null }
    })
  }

  function client() {
    return {
      auth: {
        getUser: async () => ({
          data: { user: state.user ? { id: state.user } : null },
        }),
      },
      from: (table: string) => ({
        select: () => select(table),
        insert: (values: never) => insert(table, values),
        update: (values: Partial<SessionRow>) => update(table, values),
        delete: () =>
          query((filters) =>
            table === 'session_room_members'
              ? deleteMember(filters)
              : { data: [], error: null },
          ),
      }),
      rpc: (fn: string, args: Record<string, never>) =>
        query(() => {
          if (fn === 'create_room') {
            return createRoom(args as unknown as Parameters<typeof createRoom>[0])
          }
          if (fn === 'heartbeat_room') return heartbeatRoom(args.p_room)
          if (fn === 'claim_room_host') return claimRoomHost(args.p_room)
          if (fn === 'start_room') return startRoom(args.p_room, args.p_level)
          if (fn === 'room_entry') return roomEntry(args.p_room)
          if (fn === 'declare_set')
            return declareSet(args.p_room, args.p_cursor, args.p_status)
          if (fn === 'advance_room') {
            return advanceRoom(args as unknown as Parameters<typeof advanceRoom>[0])
          }
          return { data: null, error: { code: '42883', message: 'unknown function' } }
        }),
    }
  }

  /**
   * Client navigateur : memes lectures, plus les canaux Realtime.
   *
   * Fermer un canal ne retire pas la presence : dans ces tests, un
   * participant qui ne regarde plus son ecran garde son telephone connecte.
   */
  function browserClient() {
    return {
      ...client(),
      realtime: { setAuth: async () => {} },
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

  /**
   * Historique d'un utilisateur : celui de depart, plus les seances qu'il a
   * enregistrees et closes.
   */
  function outcomesOf(userId: string): LevelOutcome[] {
    return [
      ...(state.outcomes[userId] ?? []),
      ...state.sessions
        .filter((session) => session.owner_id === userId && session.completed_at)
        .map((session) => ({
          levelId: session.level_id,
          levelNumber: session.level_number,
          validated: session.validated,
          startedAt: session.started_at,
        })),
    ]
  }

  /**
   * Coupure du telephone de `userId` : il quitte la presence du salon. Le
   * canal Realtime le voit partir, comme a la fermeture d'un onglet.
   */
  function disconnect(userId: string, roomId: string) {
    state.presence[roomId]?.delete(userId)
    syncPresence(roomId)
  }

  return { state, reset, broadcast, disconnect, client, browserClient, outcomesOf }
}

export type RoomWorld = ReturnType<typeof createRoomWorld>

// ---------------------------------------------------------------------------
// Jeu de donnees : une grille « Haut du corps » en deux versions publiees,
// quatre niveaux d'un exercice, deux series de reps par niveau -- quatre au
// niveau 3, de quoi manquer des series et revenir --, 60 s de repos.
// ---------------------------------------------------------------------------

const EXERCISES = ['Pompes', 'Tractions', 'Dips', 'Muscle-up']
const SETS_PER_LEVEL = 2
const REST_SECONDS = 60

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
        sets: Array.from({ length: position === 3 ? 4 : SETS_PER_LEVEL }, (_, index) => ({
          id: `${versionId}-s${position}-${index + 1}`,
          position: index + 1,
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
    restSeconds: REST_SECONDS,
    unchangedPrefix: 0,
    levels: [1, 2, 3, 4].map((position) => level(id, position)),
  }
}

export const VERSIONS = [version('v1', 1), version('v2', 2)]

/** La grille vue par un utilisateur : creee, suivie, ou suivie et figee en v1. */
export function gridFor(kind: 'owner' | 'follower' | 'frozen'): Grid {
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

/** Seme les niveaux et les repos de la grille, pour les fonctions du salon. */
export function seedGrid(world: RoomWorld) {
  for (const candidate of VERSIONS) {
    world.state.restSeconds[candidate.id] = candidate.restSeconds
    for (const entry of candidate.levels) {
      world.state.levels[entry.id] = {
        versionId: candidate.id,
        position: entry.position,
        setCount: entry.exercises.reduce((total, e) => total + e.sets.length, 0),
      }
    }
  }
}

/** Un joueur, son nom, sa grille et le nombre de niveaux qu'il a valides. */
export function player(
  world: RoomWorld,
  id: string,
  name: string,
  kind: 'owner' | 'follower' | 'frozen',
  validated: number,
) {
  world.state.names[id] = name
  world.state.grids[id] = gridFor(kind)
  world.state.outcomes[id] = validatedUpTo(validated)
}
