/**
 * Reperes sonores et visuels du chrono.
 *
 * L'ecran de seance se pose a un metre, pas sous les yeux : pendant un
 * gainage ou une serie explosive, on ne le regarde pas. Les reperes disent ou
 * en est le chrono sans qu'on ait a lever la tete.
 *
 * Tout ce qui se calcule vit ici, pur et teste. L'emission elle-meme — son,
 * clignotement, flash — est ailleurs, parce qu'elle touche a des API du
 * navigateur qui ne se testent pas sans navigateur.
 */

import type { TimerMode } from '@/lib/grids/model'

/** Un repere, et ce qu'il declenche. */
export type Cue = 'start' | 'beep' | 'end'

/**
 * Moments de bip, en secondes restantes, du plus loin au plus proche.
 *
 * Les bips se resserrent : une cadence constante ne dirait pas qu'on approche.
 * Une par seconde tant qu'il reste du temps, deux par seconde sous trois
 * secondes, quatre sur la derniere — l'oreille entend l'acceleration sans
 * avoir a compter.
 */
export function beepOffsets(windowSeconds: number): number[] {
  if (windowSeconds <= 0) return []

  const offsets: number[] = []
  const push = (value: number) => {
    const rounded = Math.round(value * 100) / 100
    if (rounded > 0 && rounded <= windowSeconds && !offsets.includes(rounded)) {
      offsets.push(rounded)
    }
  }

  for (let seconds = Math.floor(windowSeconds); seconds >= 3; seconds -= 1) push(seconds)
  for (let half = 3; half >= 1; half -= 0.5) push(half)
  for (let quarter = 0.75; quarter >= 0.25; quarter -= 0.25) push(quarter)

  return offsets.sort((a, b) => b - a)
}

/**
 * Duree de la fenetre d'annonce, en secondes.
 *
 * Un pourcentage de la cible et non un delai fixe : c'est ce que demande
 * l'issue, et une serie de vingt secondes n'a pas besoin du meme preavis
 * qu'une de deux minutes.
 */
export function warningWindow(targetSeconds: number, percent: number): number {
  return Math.max(0, (targetSeconds * percent) / 100)
}

/**
 * Instant vise par un repere, en secondes ecoulees depuis le depart.
 *
 * En 'strict' le chrono descend vers la limite ; en 'minimal' il monte vers la
 * cible. Dans les deux cas le moment qui compte est le meme — celui ou la
 * serie bascule — et c'est lui qu'on annonce.
 */
export function cueSchedule(
  mode: TimerMode,
  targetSeconds: number,
  percent: number,
): { beeps: number[]; end: number } | null {
  if (mode === 'none' || targetSeconds <= 0) return null

  const window = warningWindow(targetSeconds, percent)
  return {
    beeps: beepOffsets(window).map(
      (offset) => Math.round((targetSeconds - offset) * 1000) / 1000,
    ),
    end: targetSeconds,
  }
}

/**
 * Reperes a emettre entre deux instants.
 *
 * L'ecran de seance avance par ticks : on lui demande ce qui s'est passe
 * depuis le dernier, plutot que de poser un minuteur par bip. Un onglet mis en
 * arriere-plan puis revenu ne rattrape ainsi pas trente bips d'un coup — il
 * n'emet que le dernier franchi.
 */
export function cuesBetween(
  schedule: { beeps: number[]; end: number },
  fromSeconds: number,
  toSeconds: number,
): Cue[] {
  if (toSeconds <= fromSeconds) return []

  const cues: Cue[] = []
  const crossed = (instant: number) => instant > fromSeconds && instant <= toSeconds

  if (schedule.beeps.some(crossed)) cues.push('beep')
  if (crossed(schedule.end)) cues.push('end')

  return cues
}
