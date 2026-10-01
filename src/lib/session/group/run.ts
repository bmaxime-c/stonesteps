/**
 * Ce que chacun vit d'une seance de groupe, de son cote.
 *
 * Le salon porte la position commune (flow.ts) ; chaque participant y ajoute
 * ses propres resultats, qui ne quittent jamais son appareil avant la fin --
 * seul le statut est declare. Ces regles disent quel ecran montrer, quelle
 * serie se corrige encore, et ce qu'on voit des autres.
 */

import type { LevelSet } from '@/lib/grids/model'
import { isCorrectable } from '@/lib/session/correction'
import type { SetResult, SetStatus } from '@/lib/session/model'

import { closedSets, nextRoomStep, type RoomStep } from './flow'
import type { Room } from './model'

/**
 * Ecran du participant.
 *
 * 'review' est l'etape de correction du solo : une serie chronometree que ne
 * suit aucun repos se rectifie avant d'etre declaree, sans quoi le dernier a
 * declarer n'aurait jamais le temps de corriger -- l'hote avance aussitot.
 * 'waiting' : la serie est jouee et declaree, on attend le groupe, et le
 * chrono se corrige encore pendant ce temps.
 */
export type PlayerStage = 'set' | 'review' | 'waiting' | 'rest' | 'summary'

/**
 * `pending` est la serie jouee mais pas encore declaree (pendingDeclaration),
 * null si la declaration est partie ou recue.
 */
export function playerStage(
  room: Pick<Room, 'status' | 'stage' | 'cursor'>,
  results: SetResult[],
  pending: number | null = null,
): PlayerStage {
  if (room.status === 'finished') return 'summary'
  if (room.stage === 'rest') return 'rest'
  if (!results.some((result) => result.setIndex === room.cursor)) return 'set'
  return pending === room.cursor ? 'review' : 'waiting'
}

/**
 * La serie du curseur passe-t-elle par l'etape de correction avant d'etre
 * declaree ?
 *
 * Oui pour une serie chronometree que le groupe ne fera pas suivre d'un
 * repos : derniere du niveau, ou repos nul. Avec un repos, on declare tout de
 * suite et l'on corrige pendant le repos, que l'hote ne coupe pas a la
 * derniere declaration. Meme regle que le solo (session-runner.tsx).
 */
export function reviewsBeforeDeclaring(
  set: Pick<LevelSet, 'timerMode'>,
  cursor: number,
  totalSets: number,
  restSeconds: number,
): boolean {
  if (!isCorrectable(set)) return false
  return nextRoomStep({ cursor, stage: 'set' }, totalSets, restSeconds).stage !== 'rest'
}

/**
 * Serie jouee dont la declaration n'est pas encore acquise, ou null.
 *
 * `undeclared` est ce que l'appareil a retenu ; le salon a le dernier mot :
 * des que notre ligne porte une declaration a ce rang, elle est acquise, que
 * la reponse de l'appel soit revenue ou non.
 */
export function pendingDeclaration(
  undeclared: number | null,
  declaredCursor: number,
): number | null {
  if (undeclared === null || declaredCursor >= undeclared) return null
  return undeclared
}

/**
 * Resultats qui comptent : ce qu'on a joue, moins une serie que le groupe a
 * close avant d'en recevoir la declaration.
 *
 * L'hote qui force compte echoues les non-declares ; celui qui corrigeait
 * encore, ou dont la declaration est arrivee trop tard, n'avait pas declare.
 * Sa serie retombe donc dans fillSkipped, echouee comme les autres : ce qu'on
 * voit au resume est ce que le groupe a vu.
 */
export function countedResults(
  results: SetResult[],
  pending: number | null,
  step: RoomStep,
): SetResult[] {
  if (pending === null || closedSets(step) <= pending) return results
  return results.filter((result) => result.setIndex !== pending)
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
