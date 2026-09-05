import 'server-only'

import type { FriendshipStatus } from '@/lib/database.types'
import { computeStats, type HistorySession } from '@/lib/history/stats'
import { createClient } from '@/lib/supabase/server'

import { otherPartyId, type FriendshipRow } from './model'

export interface PersonSummary {
  id: string
  username: string
  displayName: string | null
}

export interface FriendsOverview {
  friends: PersonSummary[]
  incoming: PersonSummary[]
  outgoing: PersonSummary[]
  blocked: PersonSummary[]
}

interface RawFriendship {
  requester_id: string
  addressee_id: string
  status: FriendshipStatus
}

/** Toutes les relations du membre connecte, rangees par nature. */
export async function loadFriends(): Promise<FriendsOverview> {
  const empty: FriendsOverview = { friends: [], incoming: [], outgoing: [], blocked: [] }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return empty

  const { data, error } = await supabase
    .from('friendships')
    .select('requester_id, addressee_id, status')

  if (error) throw error

  const rows: FriendshipRow[] = ((data as RawFriendship[] | null) ?? []).map((r) => ({
    requesterId: r.requester_id,
    addresseeId: r.addressee_id,
    status: r.status,
  }))

  if (rows.length === 0) return empty

  const otherIds = [...new Set(rows.map((row) => otherPartyId(user.id, row)))]
  const people = await loadPeople(otherIds)
  const byId = new Map(people.map((person) => [person.id, person]))

  const overview: FriendsOverview = {
    friends: [],
    incoming: [],
    outgoing: [],
    blocked: [],
  }

  for (const row of rows) {
    const person = byId.get(otherPartyId(user.id, row))
    if (!person) continue

    if (row.status === 'blocked') overview.blocked.push(person)
    else if (row.status === 'accepted') overview.friends.push(person)
    else if (row.addresseeId === user.id) overview.incoming.push(person)
    else overview.outgoing.push(person)
  }

  return overview
}

async function loadPeople(ids: string[]): Promise<PersonSummary[]> {
  if (ids.length === 0) return []

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, display_name')
    .in('id', ids)

  if (error) throw error

  return (data ?? []).map((row) => ({
    id: row.id as string,
    username: row.username as string,
    displayName: row.display_name as string | null,
  }))
}

/**
 * Recherche par pseudo.
 *
 * Les profils sont un annuaire : sans cela, personne ne pourrait ajouter
 * personne. Ils ne portent ni adresse e-mail ni donnee sensible.
 */
export async function searchProfiles(term: string): Promise<PersonSummary[]> {
  const query = term.trim()
  if (query.length < 2) return []

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, display_name')
    .ilike('username', `%${query}%`)
    .neq('id', user.id)
    .limit(20)

  if (error) throw error

  return (data ?? []).map((row) => ({
    id: row.id as string,
    username: row.username as string,
    displayName: row.display_name as string | null,
  }))
}

export interface FriendProgress {
  person: PersonSummary
  currentLevel: { gridName: string; position: number; name: string | null } | null
  sessions: HistorySession[]
  stats: ReturnType<typeof computeStats>
}

/**
 * Progression d'un ami : son niveau courant et son historique.
 *
 * Aucune verification d'amitie ici. C'est volontaire : la RLS est la seule
 * autorite, et `sessions_select_own_or_friend` ne renvoie rien pour un
 * non-ami. Dupliquer la regle en TypeScript creerait une seconde source de
 * verite, qui finirait par diverger.
 */
export async function loadFriendProgress(
  username: string,
): Promise<FriendProgress | null> {
  const supabase = await createClient()

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, username, display_name')
    .eq('username', username)
    .maybeSingle()

  if (profileError) throw profileError
  if (!profile) return null

  const person: PersonSummary = {
    id: profile.id as string,
    username: profile.username as string,
    displayName: profile.display_name as string | null,
  }

  const { data, error } = await supabase
    .from('sessions')
    .select(
      `id, grid_id, level_id, started_at, ended_at, validated,
       grids ( name ),
       levels ( position, name ),
       set_results ( success )`,
    )
    .eq('user_id', person.id)
    .order('started_at', { ascending: false })
    .limit(50)

  if (error) throw error

  type Raw = {
    id: string
    grid_id: string
    level_id: string
    started_at: string
    ended_at: string | null
    validated: boolean
    grids: { name: string } | { name: string }[] | null
    levels:
      | { position: number; name: string | null }
      | { position: number; name: string | null }[]
      | null
    set_results: { success: boolean }[] | null
  }

  const one = <T>(value: T | T[] | null): T | null =>
    value === null ? null : Array.isArray(value) ? (value[0] ?? null) : value

  const sessions: HistorySession[] = ((data as unknown as Raw[] | null) ?? []).map(
    (raw) => {
      const results = raw.set_results ?? []
      const grid = one(raw.grids)
      const level = one(raw.levels)
      return {
        id: raw.id,
        gridId: raw.grid_id,
        gridName: grid?.name ?? 'Grille',
        levelId: raw.level_id,
        levelPosition: level?.position ?? 0,
        levelName: level?.name ?? null,
        startedAt: raw.started_at,
        endedAt: raw.ended_at,
        validated: raw.validated,
        totalSets: results.length,
        successfulSets: results.filter((r) => r.success).length,
        // Le detail des echecs n'est pas expose : le niveau et la reussite
        // globale suffisent a suivre un ami, le reste lui appartient.
        failures: [],
      }
    },
  )

  const lastValidated = sessions.find((session) => session.validated)

  return {
    person,
    currentLevel: lastValidated
      ? {
          gridName: lastValidated.gridName,
          position: lastValidated.levelPosition,
          name: lastValidated.levelName,
        }
      : null,
    sessions,
    stats: computeStats(sessions),
  }
}

/** Grilles publiques ou partagees avec le membre connecte, hors les siennes. */
export async function listDiscoverableGrids(): Promise<
  { id: string; name: string; description: string | null; ownerName: string }[]
> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('grids')
    .select('id, name, description, owner_id, profiles!grids_owner_id_fkey ( username )')
    .neq('owner_id', user.id)
    .order('name')

  if (error) throw error

  type Raw = {
    id: string
    name: string
    description: string | null
    profiles: { username: string } | { username: string }[] | null
  }

  return ((data as unknown as Raw[] | null) ?? []).map((row) => {
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      ownerName: profile?.username ?? 'inconnu',
    }
  })
}
