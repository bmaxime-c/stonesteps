/**
 * Correction du resultat d'une serie chronometree, pendant le repos qui suit.
 *
 * Le tap sur « Termine » ne dit pas exactement quand l'effort s'est arrete :
 * en plein gainage on lache avant de toucher l'ecran, et une serie 'strict'
 * finie a temps peut se clore d'office si le telephone est hors de portee. Le
 * chrono donne une premiere mesure, l'utilisateur la rectifie ensuite.
 *
 * Une correction vaut declaration : en 'strict', ramener le temps sous la
 * limite, c'est dire que la serie a ete finie a temps.
 */

import type { LevelSet } from '@/lib/grids/model'
import { setTarget } from '@/lib/grids/model'

import type { SetResult } from './model'
import { setStatus } from './status'

type TimedSet = Pick<LevelSet, 'targetReps' | 'timerMode' | 'timerSeconds'>

/** Seules les series chronometrees se corrigent apres coup. */
export function isCorrectable(set: Pick<LevelSet, 'timerMode'>): boolean {
  return set.timerMode !== 'none'
}

/**
 * Resultat recalcule pour une nouvelle valeur en secondes.
 *
 * La valeur est bornee a zero, et en 'strict' a la limite : au-dela, la serie
 * echoue de toute facon, et le chiffre n'aurait plus de sens.
 */
export function correctTimedResult(
  set: TimedSet,
  result: SetResult,
  seconds: number,
): SetResult {
  if (!isCorrectable(set)) {
    throw new Error('correctTimedResult appele sur une serie sans chrono')
  }

  const floor = Math.max(0, Math.round(seconds))
  const value = set.timerMode === 'strict' ? Math.min(floor, setTarget(set)) : floor

  return {
    ...result,
    actualValue: value,
    status: setStatus(set, { value, completed: true }),
  }
}
