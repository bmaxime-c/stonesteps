/**
 * Ce que chacun vit d'une seance de groupe, de son cote.
 *
 * Le salon porte la position commune (flow.ts) ; chaque participant y ajoute
 * ses propres resultats, qui ne quittent jamais son appareil avant la fin --
 * seul le statut est declare. Ces regles disent quel ecran montrer, quelle
 * serie se corrige encore, et ce qu'on voit des autres.
 */

import type { SetResult, SetStatus } from '@/lib/session/model'

import type { Room } from './model'

/**
 * Ecran du participant.
 *
 * 'waiting' remplace l'etape de correction du solo : la serie est jouee et
 * declaree, on attend le groupe, et le chrono se corrige pendant ce temps.
 */
export type PlayerStage = 'set' | 'waiting' | 'rest' | 'summary'

export function playerStage(
  room: Pick<Room, 'status' | 'stage' | 'cursor'>,
  results: SetResult[],
): PlayerStage {
  if (room.status === 'finished') return 'summary'
  if (room.stage === 'rest') return 'rest'
  return results.some((result) => result.setIndex === room.cursor) ? 'waiting' : 'set'
}

/**
 * Range le resultat d'une serie, ou remplace celui du meme rang.
 *
 * Une correction du chrono reecrit la serie qu'elle corrige : il n'y a jamais
 * deux resultats pour une meme serie.
 */
export function recordResult(results: SetResult[], result: SetResult): SetResult[] {
  return [
    ...results.filter((current) => current.setIndex !== result.setIndex),
    result,
  ].sort((a, b) => a.setIndex - b.setIndex)
}

/**
 * Resultat qu'on a soi-meme joue pour la serie `cursor`, s'il existe.
 *
 * `results` est ce qu'on a joue, avant que fillSkipped n'y ajoute les series
 * passees sans nous : une serie comptee echouee apres un passage force ne se
 * corrige pas.
 */
export function playedResult(results: SetResult[], cursor: number): SetResult | null {
  return results.find((result) => result.setIndex === cursor) ?? null
}

export type MemberStatus = {
  userId: string
  name: string
  present: boolean
  /** A declare la serie du curseur. */
  declared: boolean
  /** Statut declare pour cette serie, null tant qu'il n'a pas declare. */
  status: SetStatus | null
}

/**
 * Ce qu'on voit des autres pendant la seance : present ou non, a fini ou non
 * la serie du curseur, et son statut. Jamais la valeur : elle ne quitte pas
 * l'appareil de celui qui l'a faite.
 *
 * Une declaration d'une serie precedente ne dit rien de celle-ci.
 */
export function memberStatuses(
  room: Pick<Room, 'cursor' | 'members'>,
  presentIds: ReadonlySet<string>,
  selfId: string,
): MemberStatus[] {
  return room.members
    .filter((member) => member.userId !== selfId)
    .map((member) => {
      const declared = member.declaredCursor >= room.cursor
      return {
        userId: member.userId,
        name: member.displayName ?? 'Participant sans nom',
        present: presentIds.has(member.userId),
        declared,
        status: declared ? member.lastStatus : null,
      }
    })
}
