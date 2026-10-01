/**
 * Machine d'etats d'une seance de groupe.
 *
 * Le salon porte une seule position pour tout le monde : la serie du curseur
 * et son etape (serie, repos, fin). La base la fait avancer, par
 * `advance_room` ; ces regles-ci en sont le miroir, pour que l'interface sache
 * quand l'hote peut avancer, ce qui va suivre, et ce qu'un retardataire doit
 * compter echoue. Toute divergence avec la fonction SQL
 * (supabase/migrations/20261001000002_room_advance.sql) est un bug.
 */

import { setTarget, setUnit } from '@/lib/grids/model'
import type { SetResult } from '@/lib/session/model'
import { type SetStep, setLabel } from '@/lib/session/steps'
import { restView } from '@/lib/session/timer'

import type { Room, RoomStage } from './model'

/** Position du groupe dans le niveau. */
export type RoomStep = { cursor: number; stage: RoomStage }

/**
 * L'hote peut-il faire avancer le groupe sans forcer ?
 *
 * Oui quand chaque participant present a declare la serie du curseur. Un
 * absent ne bloque personne : un telephone en veille ne doit pas figer le
 * salon. Un present inconnu des membres est ignore, comme en base.
 *
 * Pendant le repos, non : il se termine au chrono, que l'hote suit par
 * `restRemaining`. La base accepterait l'appel, mais l'interface qui avancerait
 * des que possible couperait le repos de tout le monde.
 */
export function canAdvance(
  room: Pick<Room, 'status' | 'stage' | 'cursor' | 'members'>,
  presentIds: ReadonlySet<string>,
): boolean {
  if (room.status !== 'running' || room.stage !== 'set') return false
  return room.members.every(
    (member) => !presentIds.has(member.userId) || member.declaredCursor >= room.cursor,
  )
}

/**
 * Etape qui suit `step`, pour un niveau de `totalSets` series et un repos de
 * `restSeconds` secondes, ceux de la version figee du salon.
 *
 * Le repos ne fait pas avancer le curseur : il suit la serie qu'il conclut, et
 * c'est elle qu'on corrige pendant qu'il court. La derniere serie n'a pas de
 * repos, elle termine le niveau.
 */
export function nextRoomStep(
  step: RoomStep,
  totalSets: number,
  restSeconds: number,
): RoomStep {
  if (step.stage === 'finished') return step
  if (step.stage === 'rest') return { cursor: step.cursor + 1, stage: 'set' }
  if (step.cursor >= totalSets - 1) return { cursor: step.cursor, stage: 'finished' }
  if (restSeconds > 0) return { cursor: step.cursor, stage: 'rest' }
  return { cursor: step.cursor + 1, stage: 'set' }
}

/**
 * Nombre de series closes pour le groupe.
 *
 * En serie, celle du curseur est encore en cours ; au repos ou a la fin, elle
 * est derriere tout le monde.
 */
function closedSets(step: RoomStep): number {
  return step.stage === 'set' ? step.cursor : step.cursor + 1
}

/**
 * Resultats completes des series que le groupe a passees sans nous.
 *
 * Apres un passage force, le curseur du salon a depasse la derniere serie
 * declaree : chaque serie close sans resultat est comptee echouee, valeur 0.
 * Le niveau n'est donc pas valide -- on ne gagne pas un niveau en laissant
 * passer les series. Une serie deja jouee n'est jamais remplacee.
 */
export function fillSkipped(
  results: SetResult[],
  step: RoomStep,
  steps: SetStep[],
): SetResult[] {
  const played = new Set(results.map((result) => result.setIndex))
  const missing = steps
    .slice(0, closedSets(step))
    .filter((current) => !played.has(current.index))
    .map((current): SetResult => ({
      levelSetId: current.set.id,
      setIndex: current.index,
      exerciseName: current.exerciseName,
      setLabel: setLabel(current),
      unit: setUnit(current.set),
      targetValue: setTarget(current.set),
      actualValue: 0,
      status: 'fail',
    }))

  if (missing.length === 0) return results
  return [...results, ...missing].sort((a, b) => a.setIndex - b.setIndex)
}

/**
 * Secondes de repos restantes, comptees depuis l'instant pose par le serveur.
 *
 * Tout le monde part du meme `rest_started_at` : c'est ce qui donne a chacun
 * le meme compte a rebours, a la seconde pres, quel que soit le moment ou il a
 * recu l'evenement. Sans repos en cours, rien a attendre.
 */
export function restRemaining(
  restSeconds: number,
  restStartedAt: string | null,
  now: number,
): number {
  if (restStartedAt === null) return 0
  return restView(restSeconds, Date.parse(restStartedAt), now).remaining
}
