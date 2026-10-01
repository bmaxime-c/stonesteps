/**
 * Regles de passation d'hote.
 *
 * L'hote fait avancer le groupe : s'il disparait, quelqu'un doit reprendre la
 * main. La base ne sait pas qui est present -- la presence vit sur le canal
 * Realtime du salon -- et c'est donc ici que se designe le candidat. La base,
 * elle, refuse de deposseder un hote encore vivant et n'en laisse passer
 * qu'un (claim_room_host, migration 20261001000003_room_host.sql).
 */

import type { RoomMember } from './model'

/** L'hote se manifeste a ce rythme tant qu'il est la. */
export const HEARTBEAT_INTERVAL_MS = 5_000

/**
 * Silence au-dela duquel l'hote est tenu pour parti : trois battements
 * manques, pour qu'une coupure breve ne fasse pas changer d'hote. Miroir de
 * c_host_stale dans claim_room_host ; les deux doivent bouger ensemble.
 */
export const HOST_STALE_MS = 15_000

/**
 * Membre qui doit prendre la main : le present entre le plus tot, hors hote.
 *
 * Personne tant que l'hote est present, ni si aucun autre membre ne l'est.
 * Une entree simultanee se departage par identifiant, comme le fait la base
 * au depart de l'hote d'un salon ouvert : tous les clients designent le meme.
 */
export function hostCandidate(
  members: Pick<RoomMember, 'userId' | 'joinedAt'>[],
  presentIds: Iterable<string>,
  hostId: string,
): string | null {
  const present = new Set(presentIds)
  if (present.has(hostId)) return null

  const candidates = members
    .filter((member) => member.userId !== hostId && present.has(member.userId))
    .sort(
      (x, y) =>
        Date.parse(x.joinedAt) - Date.parse(y.joinedAt) ||
        (x.userId < y.userId ? -1 : x.userId > y.userId ? 1 : 0),
    )

  return candidates[0]?.userId ?? null
}

/**
 * L'hote est-il silencieux depuis plus que le seuil ?
 *
 * Strictement plus, comme le `<` de claim_room_host : pile au seuil, la base
 * le tient encore pour vivant, et l'appel serait refuse.
 */
export function hostStale(hostSeenAt: string, now: number): boolean {
  return now - Date.parse(hostSeenAt) > HOST_STALE_MS
}
