/**
 * Registre des minuteurs de la seance.
 *
 * Tous les intervalles et tous les delais passent par ici, et `stopAllTimers`
 * est le seul point d'arret. L'ecran de seance l'appelle a la sortie par la
 * croix, au retour a l'accueil depuis le resume, et au demontage. Sans ce point
 * unique, un minuteur survit toujours a un chemin de sortie qu'on avait oublie,
 * et continue a vibrer dans le vide une fois la seance finie.
 */

type IntervalHandle = ReturnType<typeof setInterval>
type TimeoutHandle = ReturnType<typeof setTimeout>

const intervals = new Set<IntervalHandle>()
const timeouts = new Set<TimeoutHandle>()

/** Intervalle repete : l'horloge de rendu. */
export function startTimer(callback: () => void, intervalMs: number): IntervalHandle {
  const handle = setInterval(callback, intervalMs)
  intervals.add(handle)
  return handle
}

export function stopTimer(handle: IntervalHandle): void {
  clearInterval(handle)
  intervals.delete(handle)
}

/**
 * Declenchement unique : fin de repos, cloture d'une serie 'strict'.
 *
 * Un delai plutot qu'un sondage a chaque tick — le moment est connu d'avance,
 * il n'y a rien a surveiller.
 */
export function startDelay(callback: () => void, delayMs: number): TimeoutHandle {
  const handle = setTimeout(() => {
    timeouts.delete(handle)
    callback()
  }, delayMs)
  timeouts.add(handle)
  return handle
}

export function stopDelay(handle: TimeoutHandle): void {
  clearTimeout(handle)
  timeouts.delete(handle)
}

export function stopAllTimers(): void {
  for (const handle of intervals) clearInterval(handle)
  intervals.clear()
  for (const handle of timeouts) clearTimeout(handle)
  timeouts.clear()
}

/** Nombre de minuteurs en cours, tous types confondus. Sert aux tests. */
export function runningTimerCount(): number {
  return intervals.size + timeouts.size
}
