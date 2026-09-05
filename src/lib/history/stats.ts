/**
 * Statistiques d'entrainement, calculees a partir de l'historique.
 *
 * Module pur : il prend des seances deja chargees et n'interroge rien. C'est
 * ce qui permet de le tester sans base, et de le reutiliser plus tard pour
 * afficher la progression d'un ami sans dupliquer la logique.
 */

export interface HistorySession {
  id: string
  gridId: string
  gridName: string
  levelId: string
  levelPosition: number
  levelName: string | null
  startedAt: string
  endedAt: string | null
  validated: boolean
  totalSets: number
  successfulSets: number
  /** Series echouees, avec le nom de l'exercice concerne. */
  failures: { exerciseName: string; repsDone: number | null }[]
}

export interface TrainingStats {
  sessionCount: number
  validatedCount: number
  totalSets: number
  successfulSets: number
  /** Part de series reussies, entre 0 et 1. Null si aucune serie. */
  successRate: number | null
  /** Seances par semaine sur la periode observee. Null si moins de deux seances. */
  sessionsPerWeek: number | null
  /** Exercice qui fait echouer le plus souvent. Null si aucun echec. */
  mostBlocking: { exerciseName: string; failures: number } | null
  currentStreak: number
}

const DAY = 24 * 60 * 60 * 1000

function dayKey(iso: string): string {
  return iso.slice(0, 10)
}

export function computeStats(sessions: readonly HistorySession[]): TrainingStats {
  const totalSets = sessions.reduce((sum, s) => sum + s.totalSets, 0)
  const successfulSets = sessions.reduce((sum, s) => sum + s.successfulSets, 0)

  const failureCounts = new Map<string, number>()
  for (const session of sessions) {
    for (const failure of session.failures) {
      failureCounts.set(
        failure.exerciseName,
        (failureCounts.get(failure.exerciseName) ?? 0) + 1,
      )
    }
  }

  let mostBlocking: TrainingStats['mostBlocking'] = null
  for (const [exerciseName, failures] of failureCounts) {
    // A egalite, l'ordre alphabetique tranche : le resultat doit etre stable
    // d'un affichage a l'autre.
    if (
      mostBlocking === null ||
      failures > mostBlocking.failures ||
      (failures === mostBlocking.failures && exerciseName < mostBlocking.exerciseName)
    ) {
      mostBlocking = { exerciseName, failures }
    }
  }

  return {
    sessionCount: sessions.length,
    validatedCount: sessions.filter((s) => s.validated).length,
    totalSets,
    successfulSets,
    successRate: totalSets === 0 ? null : successfulSets / totalSets,
    sessionsPerWeek: computeSessionsPerWeek(sessions),
    mostBlocking,
    currentStreak: computeStreak(sessions),
  }
}

/**
 * Cadence moyenne sur la periode reellement observee, de la premiere a la
 * derniere seance. Sans deux seances, il n'y a pas d'intervalle : mieux vaut
 * ne rien annoncer qu'un chiffre invente.
 */
export function computeSessionsPerWeek(
  sessions: readonly HistorySession[],
): number | null {
  if (sessions.length < 2) return null

  const times = sessions.map((s) => Date.parse(s.startedAt)).sort((a, b) => a - b)
  const spanMs = times[times.length - 1] - times[0]
  if (spanMs <= 0) return null

  const weeks = spanMs / (7 * DAY)
  return Math.round((sessions.length / weeks) * 10) / 10
}

/**
 * Nombre de jours consecutifs, en remontant depuis la derniere seance, ou au
 * moins une seance a eu lieu. Plusieurs seances le meme jour comptent pour un.
 */
export function computeStreak(sessions: readonly HistorySession[]): number {
  if (sessions.length === 0) return 0

  const days = [...new Set(sessions.map((s) => dayKey(s.startedAt)))].sort().reverse()

  let streak = 1
  for (let index = 1; index < days.length; index += 1) {
    const previous = Date.parse(`${days[index - 1]}T00:00:00Z`)
    const current = Date.parse(`${days[index]}T00:00:00Z`)
    if (previous - current !== DAY) break
    streak += 1
  }
  return streak
}

export interface ProgressPoint {
  date: string
  levelPosition: number
  levelName: string | null
}

/**
 * Niveaux valides dans le temps, un point par niveau atteint pour la premiere
 * fois. Revalider un niveau deja franchi n'ajoute pas de point : la courbe
 * decrit la progression, pas l'activite.
 */
export function buildProgressPoints(
  sessions: readonly HistorySession[],
): ProgressPoint[] {
  const seen = new Set<string>()
  return sessions
    .filter((session) => session.validated)
    .slice()
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt))
    .filter((session) => {
      if (seen.has(session.levelId)) return false
      seen.add(session.levelId)
      return true
    })
    .map((session) => ({
      date: session.startedAt,
      levelPosition: session.levelPosition,
      levelName: session.levelName,
    }))
}

export function formatPercent(ratio: number | null): string {
  if (ratio === null) return '—'
  return `${Math.round(ratio * 100)} %`
}
