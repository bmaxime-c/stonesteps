/**
 * Agregations statistiques.
 *
 * Toutes lisent les seances consolidees et rien d'autre : le meme calcul de
 * statut alimente l'ecran de seance et ces chiffres, sans quoi le resume et
 * les statistiques finiraient par ne plus dire la meme chose.
 *
 * Les seances sont regroupees par `gridName` et non par `gridId` : le nom est
 * un snapshot, toujours present, la ou l'identifiant passe a null quand la
 * grille est supprimee. Une grille effacee garde ainsi son historique.
 */

import type { SessionRecord, SetResult, SetStatus, SetUnit } from '@/lib/session/model'

// ---------------------------------------------------------------------------
// Indicateurs de tete
// ---------------------------------------------------------------------------

export type Kpis = {
  sessionCount: number
  validatedLevels: number
  totalReps: number
  /** Entre 0 et 1. Vaut 0 quand aucune serie n'a ete jouee. */
  successRate: number
}

/**
 * Les quatre chiffres de tete.
 *
 * `successRate` agrege les depassements aux reussites : (reussies + depassees)
 * sur le total. C'est le seul endroit ou 'surpass' se fond dans 'success' —
 * partout ailleurs, pastilles, resume, repartition, points de courbe, il reste
 * un statut distinct.
 *
 * `validatedLevels` compte des niveaux, pas des seances : rejouer un niveau
 * deja valide ne le compte pas deux fois.
 */
export function kpis(sessions: SessionRecord[]): Kpis {
  const validated = new Set<string>()
  let totalReps = 0
  let setCount = 0
  let achieved = 0

  for (const session of sessions) {
    if (session.validated) {
      validated.add(`${session.gridName}#${session.levelNumber}`)
    }
    for (const result of session.results) {
      setCount += 1
      if (result.status !== 'fail') achieved += 1
      if (result.unit === 'reps') totalReps += result.actualValue
    }
  }

  return {
    sessionCount: sessions.length,
    validatedLevels: validated.size,
    totalReps,
    successRate: setCount === 0 ? 0 : achieved / setCount,
  }
}

// ---------------------------------------------------------------------------
// Selecteurs
// ---------------------------------------------------------------------------

/** Grilles presentes dans l'historique, par ordre d'apparition. */
export function gridNames(sessions: SessionRecord[]): string[] {
  return [...new Set(sessions.map((session) => session.gridName))]
}

/** Exercices presents dans l'historique, par ordre d'apparition. */
export function exerciseNames(sessions: SessionRecord[]): string[] {
  const names: string[] = []
  for (const session of sessions) {
    for (const result of session.results) {
      if (!names.includes(result.exerciseName)) names.push(result.exerciseName)
    }
  }
  return names
}

// ---------------------------------------------------------------------------
// Progression par grille : niveau atteint au fil des seances
// ---------------------------------------------------------------------------

export type LevelPoint = {
  startedAt: string
  levelNumber: number
  validated: boolean
}

/** Un point par seance, dans l'ordre chronologique. Courbe en escalier. */
export function levelProgress(sessions: SessionRecord[], gridName: string): LevelPoint[] {
  return sessions
    .filter((session) => session.gridName === gridName)
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt))
    .map((session) => ({
      startedAt: session.startedAt,
      levelNumber: session.levelNumber,
      validated: session.validated,
    }))
}

export type LevelAttempt = {
  levelNumber: number
  attempts: number
  /** Date de la premiere seance qui a valide le niveau, ou null. */
  validatedAt: string | null
}

/**
 * Tentatives et date de validation par niveau, pour une grille.
 *
 * C'est la vue qui montre ou l'utilisateur bloque : un niveau a cinq
 * tentatives et toujours pas valide saute aux yeux.
 */
export function levelAttempts(
  sessions: SessionRecord[],
  gridName: string,
): LevelAttempt[] {
  const byLevel = new Map<number, { attempts: number; validatedAt: string | null }>()

  for (const session of sessions) {
    if (session.gridName !== gridName) continue

    const entry = byLevel.get(session.levelNumber) ?? { attempts: 0, validatedAt: null }
    entry.attempts += 1
    if (session.validated) {
      // La premiere validation fait foi : rejouer un niveau deja valide ne
      // repousse pas sa date.
      entry.validatedAt =
        entry.validatedAt === null || session.startedAt < entry.validatedAt
          ? session.startedAt
          : entry.validatedAt
    }
    byLevel.set(session.levelNumber, entry)
  }

  return [...byLevel.entries()]
    .map(([levelNumber, entry]) => ({ levelNumber, ...entry }))
    .sort((a, b) => a.levelNumber - b.levelNumber)
}

// ---------------------------------------------------------------------------
// Progression par exercice : effectue vs objectif
// ---------------------------------------------------------------------------

export type ExercisePoint = {
  startedAt: string
  unit: SetUnit
  actual: number
  target: number
  status: SetStatus
}

/** Le pire statut l'emporte : un point ne se colore pas en vert sur un echec. */
function worstStatus(results: Pick<SetResult, 'status'>[]): SetStatus {
  if (results.some((r) => r.status === 'fail')) return 'fail'
  if (results.every((r) => r.status === 'surpass')) return 'surpass'
  return 'success'
}

/**
 * Un point par seance pour un exercice : total effectue contre total vise.
 *
 * Les series sont sommees, pas moyennees : c'est bien « reps effectuees vs
 * objectif » sur la seance. Un meme exercice pouvant changer de mode d'un
 * niveau a l'autre, seules les series de l'unite dominante de la seance sont
 * retenues — additionner des secondes a des repetitions ne voudrait rien dire.
 */
export function exerciseProgress(
  sessions: SessionRecord[],
  exerciseName: string,
): ExercisePoint[] {
  const points: ExercisePoint[] = []

  for (const session of [...sessions].sort((a, b) =>
    a.startedAt.localeCompare(b.startedAt),
  )) {
    const all = session.results.filter((r) => r.exerciseName === exerciseName)
    if (all.length === 0) continue

    const unit = all[0].unit
    const kept = all.filter((r) => r.unit === unit)

    points.push({
      startedAt: session.startedAt,
      unit,
      actual: kept.reduce((sum, r) => sum + r.actualValue, 0),
      target: kept.reduce((sum, r) => sum + r.targetValue, 0),
      status: worstStatus(kept),
    })
  }

  return points
}

// ---------------------------------------------------------------------------
// Repartition et regularite
// ---------------------------------------------------------------------------

/** Comptes reussi / depasse / echoue sur tout l'historique. */
export function statusDistribution(sessions: SessionRecord[]): Record<SetStatus, number> {
  const counts: Record<SetStatus, number> = { success: 0, surpass: 0, fail: 0 }
  for (const session of sessions) {
    for (const result of session.results) counts[result.status] += 1
  }
  return counts
}

/** Cle de jour en heure locale : c'est le calendrier de l'utilisateur. */
export function dayKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export type RegularityDay = { day: string; active: boolean }

/**
 * Presence d'une seance jour par jour, du plus ancien au plus recent.
 *
 * `days` jours au total, `today` compris — la grille de l'ecran de stats en
 * affiche 35, soit cinq lignes de sept.
 */
export function regularity(
  sessions: SessionRecord[],
  today: Date,
  days = 35,
): RegularityDay[] {
  const active = new Set(sessions.map((s) => dayKey(new Date(s.startedAt))))
  const result: RegularityDay[] = []

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(today)
    date.setDate(date.getDate() - offset)
    const day = dayKey(date)
    result.push({ day, active: active.has(day) })
  }

  return result
}
