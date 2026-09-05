import type { TimerMode } from '@/lib/database.types'

/**
 * Semantique des deux modes de chrono. C'est une regle metier, pas un detail
 * d'affichage : elle decide de la reussite d'une serie.
 *
 *  - `minimal` : il faut TENIR au moins la duree prevue. Un arret anticipe est
 *    un echec, et la duree reellement tenue est enregistree.
 *  - `strict`  : il faut FINIR en au plus la duree prevue. Le depassement est
 *    un echec.
 */

export interface TimedVerdict {
  success: boolean
  /** Explication courte, affichee apres la serie. */
  reason: string
}

export function evaluateTimedSet(
  mode: Exclude<TimerMode, 'none'>,
  targetSeconds: number,
  actualSeconds: number,
): TimedVerdict {
  const actual = Math.max(0, Math.round(actualSeconds))

  if (mode === 'minimal') {
    return actual >= targetSeconds
      ? { success: true, reason: `${actual} s tenues, objectif ${targetSeconds} s.` }
      : {
          success: false,
          reason: `Arrete a ${actual} s, il en fallait ${targetSeconds}.`,
        }
  }

  return actual <= targetSeconds
    ? { success: true, reason: `Termine en ${actual} s, limite ${targetSeconds} s.` }
    : { success: false, reason: `${actual} s, la limite etait de ${targetSeconds} s.` }
}

/**
 * Sens de lecture du chrono a l'ecran.
 *
 * En `minimal` on decompte vers zero : ce qui compte est le temps qu'il reste
 * a tenir. En `strict` on compte a l'endroit, en montrant le temps consomme
 * sur le budget.
 */
export function displaySeconds(
  mode: Exclude<TimerMode, 'none'>,
  targetSeconds: number,
  elapsedSeconds: number,
): number {
  const elapsed = Math.max(0, Math.floor(elapsedSeconds))
  return mode === 'minimal' ? Math.max(0, targetSeconds - elapsed) : elapsed
}

/** Le chrono a-t-il atteint son terme naturel ? */
export function isTimerComplete(
  mode: Exclude<TimerMode, 'none'>,
  targetSeconds: number,
  elapsedSeconds: number,
): boolean {
  return Math.floor(elapsedSeconds) >= targetSeconds
}

/** « 1:05 », « 45 s ». */
export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds))
  if (total < 60) return `${total} s`
  const minutes = Math.floor(total / 60)
  const rest = total % 60
  return `${minutes}:${String(rest).padStart(2, '0')}`
}
