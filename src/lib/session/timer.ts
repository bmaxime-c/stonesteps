/**
 * Chrono de serie et compte a rebours de repos.
 *
 * Tout est pilote par un temps injecte : aucune fonction ici ne lit l'horloge.
 * C'est ce qui les rend testables sans attendre, et ce qui permet a l'ecran de
 * seance de recalculer son etat apres un rafraichissement a partir du seul
 * instant de depart.
 */

import type { LevelSet } from '@/lib/grids/model'
import { setTarget } from '@/lib/grids/model'

import type { SetStatus } from './model'
import { setStatus } from './status'

/** Secondes ecoulees depuis `startedAt`, jamais negatives. */
export function elapsedSeconds(startedAt: number, now: number): number {
  return Math.max(0, Math.floor((now - startedAt) / 1000))
}

export type TimerView = {
  /** Secondes ecoulees depuis le depart. */
  elapsed: number
  /** Ce qu'affiche le chiffre : croissant en 'minimal', restant en 'strict'. */
  display: number
  /** Remplissage de l'anneau, borne a [0, 1]. */
  progress: number
  /** 'strict' : la limite est atteinte, la serie est close d'office. */
  expired: boolean
  /**
   * Statut affiche pendant l'effort.
   *
   * En 'minimal' il evolue en direct — echoue tant que la cible n'est pas
   * atteinte, puis reussi, puis depasse. En 'strict' il reste neutre (null)
   * jusqu'a la validation : annoncer un verdict pendant un compte a rebours
   * pousserait a s'arreter des qu'il passe au vert.
   */
  liveStatus: SetStatus | null
}

/**
 * Etat du chrono d'une serie chronometree a l'instant `now`.
 *
 * Lever sur une serie sans chrono serait une erreur d'appel : l'ecran affiche
 * soit un compteur de reps, soit un anneau, jamais les deux.
 */
export function timerView(
  set: Pick<LevelSet, 'targetReps' | 'timerMode' | 'timerSeconds'>,
  startedAt: number,
  now: number,
): TimerView {
  if (set.timerMode === 'none') {
    throw new Error('timerView appele sur une serie sans chrono')
  }

  const limit = setTarget(set)
  const elapsed = elapsedSeconds(startedAt, now)
  const progress = limit > 0 ? Math.min(1, elapsed / limit) : 1

  if (set.timerMode === 'minimal') {
    return {
      elapsed,
      display: elapsed,
      progress,
      expired: false,
      liveStatus: setStatus(set, { value: elapsed }),
    }
  }

  const expired = elapsed >= limit
  return {
    elapsed,
    display: Math.max(0, limit - elapsed),
    progress,
    expired,
    liveStatus: expired ? 'fail' : null,
  }
}

/**
 * Statut definitif d'une serie chronometree au moment ou l'utilisateur valide.
 *
 * En 'strict', `expired` vaut la cloture automatique : la serie echoue sans
 * que l'utilisateur ait a faire quoi que ce soit.
 */
export function timerFinalStatus(
  set: Pick<LevelSet, 'targetReps' | 'timerMode' | 'timerSeconds'>,
  elapsed: number,
  completed: boolean,
): SetStatus {
  return setStatus(set, { value: elapsed, completed })
}

export type RestView = {
  remaining: number
  done: boolean
}

/**
 * Compte a rebours de repos.
 *
 * `restSeconds` a zero desactive le repos : la vue est immediatement terminee,
 * et l'ecran enchaine sur la serie suivante sans rien afficher.
 */
export function restView(restSeconds: number, startedAt: number, now: number): RestView {
  const remaining = Math.max(0, restSeconds - elapsedSeconds(startedAt, now))
  return { remaining, done: remaining === 0 }
}
