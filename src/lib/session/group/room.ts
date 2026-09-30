/**
 * Regles d'un salon de seance a plusieurs.
 *
 * Tout le monde joue le meme niveau, sur la meme version figee : le niveau
 * choisi ne peut donc pas depasser ce que le moins avance a atteint. On ne
 * saute jamais un niveau, pas plus a plusieurs que seul.
 *
 * La base tient les places et le lancement sous verrou ; ces regles-ci
 * disent a l'application ce qu'il faut refuser avant d'ecrire, et a
 * l'interface ce qu'elle peut proposer.
 */

import type { Database } from '@/lib/database.types'
import type { Level } from '@/lib/grids/model'
import type { GridProgress } from '@/lib/grids/progress'

export type RoomStatus = Database['public']['Enums']['room_status']

/** Six participants au plus, hote compris. Le trigger d'entree tient la meme borne. */
export const ROOM_CAPACITY = 6

export type RoomMemberCeiling = { userId: string; levelCeiling: number }

/**
 * Plafond d'un membre : la position de son niveau en cours.
 *
 * Une grille terminee n'a plus de niveau en cours ; tous ses niveaux sont
 * alors rejouables, et le plafond vaut leur nombre.
 */
export function memberCeiling(
  progress: Pick<GridProgress, 'current'> & { version: { levels: unknown[] } },
): number {
  return progress.current?.position ?? progress.version.levels.length
}

/**
 * Plafond du salon : celui du membre le moins avance.
 *
 * Un salon sans membre n'offre aucun niveau : 0, et non l'infini, pour que
 * rien ne soit selectionnable par accident.
 */
export function roomCeiling(members: Pick<RoomMemberCeiling, 'levelCeiling'>[]): number {
  if (members.length === 0) return 0
  return Math.min(...members.map((member) => member.levelCeiling))
}

/** Niveaux que l'hote peut choisir, dans l'ordre des positions. */
export function selectableLevels<L extends Pick<Level, 'position'>>(
  levels: L[],
  ceiling: number,
): L[] {
  return [...levels]
    .filter((level) => level.position <= ceiling)
    .sort((a, b) => a.position - b.position)
}

/**
 * Motif de refus d'entree.
 *
 * - `started` : le salon est lance (ou termine), il n'accepte plus personne ;
 * - `full` : les six places sont prises ;
 * - `not_following` : la grille n'est pas chez l'utilisateur ; publique, il
 *   peut l'adopter puis revenir ;
 * - `version` : la version qu'il joue n'est pas celle du salon.
 */
export type JoinRefusal = 'started' | 'full' | 'not_following' | 'version'

export type JoinContext = {
  userId: string
  room: {
    status: RoomStatus
    gridVersionId: string
    members: Pick<RoomMemberCeiling, 'userId'>[]
  }
  /** La grille est chez lui : il l'a creee ou il la suit. */
  follows: boolean
  /** Version qu'il joue, null s'il n'en a aucune. */
  playableVersionId: string | null
}

/**
 * Refus d'entree dans un salon, ou null si l'entree est permise.
 *
 * Un membre deja inscrit revient toujours, lance ou pas, et quelle que soit
 * sa version du moment : il est entre sur la version figee du salon, c'est
 * elle qu'il joue ici.
 *
 * Pour les autres, on refuse d'abord ce que l'utilisateur ne peut pas
 * corriger (salon lance, salon complet) : lui proposer d'adopter la grille
 * pour se heurter ensuite a une porte fermee serait une fausse piste.
 */
export function joinRefusal(context: JoinContext): JoinRefusal | null {
  const { room } = context

  if (room.members.some((member) => member.userId === context.userId)) return null
  if (room.status !== 'open') return 'started'
  if (room.members.length >= ROOM_CAPACITY) return 'full'
  if (!context.follows) return 'not_following'
  if (context.playableVersionId !== room.gridVersionId) return 'version'

  return null
}
