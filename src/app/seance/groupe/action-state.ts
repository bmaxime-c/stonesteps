import type { JoinRefusal } from '@/lib/session/group/room'

/**
 * Sorties des actions de salon.
 *
 * Hors de actions.ts : un module « use server » ne peut exporter que des
 * fonctions asynchrones.
 */

export type CreateRoomResult =
  { roomId: string; error: null } | { roomId: null; error: string }

/**
 * Motif d'un refus d'entree, en plus du message.
 *
 * L'interface en a besoin pour autre chose qu'afficher : `not_following`
 * ouvre l'ecran d'adoption quand la grille est publique. `not_found` couvre
 * aussi le salon qu'on n'a pas le droit de lire : du dehors, les deux se
 * confondent.
 */
export type JoinRoomRefusal = JoinRefusal | 'not_found' | 'unknown'

/**
 * `gridId` accompagne `not_following` : un non-membre ne lit pas le salon, et
 * la page n'a que lui pour retrouver la grille a adopter.
 */
export type JoinRoomResult =
  | { error: null; refusal: null }
  | { error: string; refusal: JoinRoomRefusal; gridId?: string }

export type RoomActionResult = { error: string | null }

/**
 * Sortie d'une declaration ou d'une avance du groupe.
 *
 * `stale` : le salon avait deja bouge -- serie passee par le groupe, double
 * tap, second onglet de l'hote. Ce n'est pas une erreur a montrer : le salon
 * se relit, et l'ecran suit l'etat que la base a retenu.
 */
export type RoomStepResult = { error: string | null; stale: boolean }
