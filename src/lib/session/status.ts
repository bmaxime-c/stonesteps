/**
 * Statut d'une serie.
 *
 * Une seule comparaison par type de serie, et elle vit ici : les composants
 * affichent un statut, ils ne le calculent pas. C'est aussi ce qui alimente
 * les statistiques, qui doivent lire exactement la meme regle que l'ecran de
 * seance.
 *
 *   sans chrono   reps effectuees vs objectif   egal / superieur / inferieur
 *   minimal       secondes tenues vs objectif   egal / superieur / inferieur
 *   strict        secondes ecoulees vs limite   terminee avant la limite,
 *                                               depassement sous 50 % de la
 *                                               limite, echec si la limite est
 *                                               atteinte sans validation
 */

import type { LevelSet } from '@/lib/grids/model'
import { setTarget } from '@/lib/grids/model'

import type { SetStatus } from './model'

/** Comparaison commune aux series sans chrono et aux series 'minimal'. */
export function compareStatus(actual: number, target: number): SetStatus {
  if (actual > target) return 'surpass'
  if (actual === target) return 'success'
  return 'fail'
}

/**
 * Statut d'une serie 'strict'.
 *
 * `completed` dit si l'utilisateur a valide avant la fin du compte a rebours.
 * Sans validation, la serie est cloturee en echec des que la limite est
 * atteinte — c'est le chrono qui tranche, pas l'utilisateur.
 */
export function strictStatus(
  elapsedSeconds: number,
  limitSeconds: number,
  completed: boolean,
): SetStatus {
  if (!completed || elapsedSeconds >= limitSeconds) return 'fail'
  // « Sous 50 % de la limite » : strictement en dessous de la moitie.
  return elapsedSeconds * 2 < limitSeconds ? 'surpass' : 'success'
}

export type SetOutcome = {
  /**
   * Reps effectuees en mode 'none', secondes tenues en 'minimal', secondes
   * ecoulees en 'strict'.
   */
  value: number
  /** N'a de sens qu'en mode 'strict'. Une serie non validee y echoue. */
  completed?: boolean
}

/** Statut d'une serie, quel que soit son mode. */
export function setStatus(
  set: Pick<LevelSet, 'targetReps' | 'timerMode' | 'timerSeconds'>,
  outcome: SetOutcome,
): SetStatus {
  const target = setTarget(set)

  if (set.timerMode === 'strict') {
    return strictStatus(outcome.value, target, outcome.completed ?? true)
  }

  return compareStatus(outcome.value, target)
}
