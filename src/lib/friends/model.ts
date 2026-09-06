import type { FriendshipStatus } from '@/lib/database.types'

/**
 * Lecture d'une amitie du point de vue de celui qui regarde.
 *
 * La table `friendships` est asymetrique — elle retient qui a demande — mais
 * l'interface doit dire « demande recue » ou « demande envoyee » selon le
 * cote ou l'on se trouve. Ce module fait cette traduction, et rien d'autre :
 * il est pur, donc testable sans base.
 */

export interface FriendshipRow {
  requesterId: string
  addresseeId: string
  status: FriendshipStatus
}

export type Relation =
  'none' | 'self' | 'friends' | 'incoming-request' | 'outgoing-request' | 'blocked'

export function resolveRelation(
  viewerId: string,
  otherId: string,
  rows: readonly FriendshipRow[],
): Relation {
  if (viewerId === otherId) return 'self'

  const row = rows.find(
    (r) =>
      (r.requesterId === viewerId && r.addresseeId === otherId) ||
      (r.requesterId === otherId && r.addresseeId === viewerId),
  )

  if (!row) return 'none'
  if (row.status === 'blocked') return 'blocked'
  if (row.status === 'accepted') return 'friends'

  return row.addresseeId === viewerId ? 'incoming-request' : 'outgoing-request'
}

/** Identifiant de l'autre partie, quel que soit le sens de la demande. */
export function otherPartyId(viewerId: string, row: FriendshipRow): string {
  return row.requesterId === viewerId ? row.addresseeId : row.requesterId
}

export const RELATION_LABELS: Record<Relation, string> = {
  none: 'Pas encore en relation',
  self: 'Toi',
  friends: 'Ami',
  'incoming-request': 'Demande recue',
  'outgoing-request': 'Demande envoyee',
  blocked: 'Bloque',
}
