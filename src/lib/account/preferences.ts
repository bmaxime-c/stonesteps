/**
 * Preferences de reperes du chrono.
 *
 * Trois canaux — le son, le clignotement de l'ecran, le flash de l'appareil
 * photo — et la fenetre a partir de laquelle la fin est annoncee. Chacun se
 * coupe : on ne s'entraine pas toujours dans un endroit ou l'on peut faire du
 * bruit, ni avec un telephone pose face en l'air.
 */

export type TimerCuePreferences = {
  sound: boolean
  blink: boolean
  flash: boolean
  /** Fenetre d'annonce, en pourcentage de la duree visee. */
  warningPercent: number
}

export const WARNING_PERCENT_MIN = 5
export const WARNING_PERCENT_MAX = 50
export const WARNING_PERCENT_STEP = 5

/**
 * Valeurs par defaut.
 *
 * Le flash est le seul a partir eteint : il demande l'acces a la camera, et on
 * ne reclame pas une permission sans que l'utilisateur l'ait voulue.
 */
export const DEFAULT_TIMER_CUES: TimerCuePreferences = {
  sound: true,
  blink: true,
  flash: false,
  warningPercent: 15,
}

export function stepWarningPercent(value: number, delta: number): number {
  const next = value + delta * WARNING_PERCENT_STEP
  return Math.min(WARNING_PERCENT_MAX, Math.max(WARNING_PERCENT_MIN, next))
}

export function isValidWarningPercent(value: number): boolean {
  return (
    Number.isInteger(value) &&
    value >= WARNING_PERCENT_MIN &&
    value <= WARNING_PERCENT_MAX
  )
}

/**
 * Ce que le pourcentage donne concretement.
 *
 * Un reglage en pourcentage ne parle pas tout seul : on l'illustre sur une
 * serie type, sans quoi personne ne sait ce que « 15 % » represente.
 */
export function describeWarningWindow(percent: number, exampleSeconds = 40): string {
  const seconds = Math.round((exampleSeconds * percent) / 100)
  return `${percent} % — environ ${seconds} s sur une série de ${exampleSeconds} s`
}

/** Un utilisateur qui a tout coupe n'a aucun repere a recevoir. */
export function hasAnyCue(preferences: TimerCuePreferences): boolean {
  return preferences.sound || preferences.blink || preferences.flash
}
