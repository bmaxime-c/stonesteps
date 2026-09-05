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
 * Sens de lecture du chrono a l'ecran : les deux modes decomptent.
 *
 * En `minimal`, ce qui compte est le temps qu'il reste a tenir. En `strict`,
 * c'est le temps qu'il reste pour finir. Dans les deux cas la question posee a
 * celui qui s'entraine est « combien de temps encore », jamais « combien de
 * temps deja ».
 *
 * Le decompte s'arrete a zero. Le depassement n'est pas affiche mais reste
 * enregistre : c'est `evaluateTimedSet` qui juge, sur la duree reelle.
 */
export function displaySeconds(targetSeconds: number, elapsedSeconds: number): number {
  const elapsed = Math.max(0, Math.floor(elapsedSeconds))
  return Math.max(0, targetSeconds - elapsed)
}

/** Part du temps ecoulee au-dela de laquelle le chrono strict quitte le vert. */
export const URGENCY_THRESHOLD = 0.85

/**
 * Degre d'urgence d'un chrono strict, entre 0 et 1.
 *
 * Vaut 0 tant qu'au plus 85 % du temps est consomme — le chrono reste vert —
 * puis monte continument jusqu'a 1 a l'echeance. C'est ce nombre qui pilote
 * l'interpolation de l'orange vers le rouge : la couleur previent d'un budget
 * qui se vide, elle ne se contente pas d'annoncer la fin.
 */
export function timerUrgency(targetSeconds: number, elapsedSeconds: number): number {
  if (targetSeconds <= 0) return 1

  const ratio = Math.min(1, Math.max(0, elapsedSeconds / targetSeconds))
  if (ratio <= URGENCY_THRESHOLD) return 0

  return (ratio - URGENCY_THRESHOLD) / (1 - URGENCY_THRESHOLD)
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
