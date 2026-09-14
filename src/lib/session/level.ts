/**
 * Validation d'un niveau et progression d'une grille.
 *
 * Regle centrale de l'application : un niveau n'est valide que si toutes les
 * series de tous ses exercices sont reussies. Une seule serie manquee invalide
 * le niveau entier, et la seance suivante repart du meme niveau, a l'identique.
 * Toute evolution qui assouplit cette regle se discute, elle ne se decide pas
 * en passant.
 */

import type { Grid, Level } from '@/lib/grids/model'

import type { LevelOutcome, SetResult, SetStatus } from './model'

/**
 * Verdict tout-ou-rien d'un niveau.
 *
 * Un depassement compte comme une reussite : c'est un objectif atteint, et
 * au-dela. Seul 'fail' invalide.
 */
export function isLevelValidated(results: Pick<SetResult, 'status'>[]): boolean {
  // Un niveau sans serie n'est pas un niveau valide : c'est une grille
  // incomplete, que la validation de grille refuse par ailleurs.
  if (results.length === 0) return false
  return results.every((result) => result.status !== 'fail')
}

/** Nombre de series manquees, pour le sous-titre du resume. */
export function failedSetCount(results: Pick<SetResult, 'status'>[]): number {
  return results.filter((result) => result.status === 'fail').length
}

/** Comptes par statut, pour les trois compteurs du resume. */
export function countByStatus(
  results: Pick<SetResult, 'status'>[],
): Record<SetStatus, number> {
  const counts: Record<SetStatus, number> = { success: 0, surpass: 0, fail: 0 }
  for (const result of results) counts[result.status] += 1
  return counts
}

/**
 * Niveau en cours d'une grille : le premier sans seance validee.
 *
 * Il se derive de l'historique, il ne se stocke pas. Une colonne qu'il
 * faudrait tenir a jour finirait par diverger des seances.
 *
 * Renvoie null quand tous les niveaux ont ete valides : la grille est
 * terminee, il n'y a plus rien a lancer.
 */
export function currentLevel(
  levels: Pick<Level, 'id' | 'position'>[],
  outcomes: Pick<LevelOutcome, 'levelId' | 'validated'>[],
): Pick<Level, 'id' | 'position'> | null {
  const validated = new Set(
    outcomes.filter((o) => o.validated && o.levelId).map((o) => o.levelId as string),
  )

  return (
    [...levels]
      .sort((a, b) => a.position - b.position)
      .find((level) => !validated.has(level.id)) ?? null
  )
}

export type LevelState = 'validated' | 'current' | 'locked'

/**
 * Etat de chaque niveau d'une grille, dans l'ordre des positions.
 *
 * On ne saute jamais un niveau : tout ce qui suit le niveau en cours est
 * verrouille, meme si une seance validee existait par accident plus loin.
 * C'est la position dans la suite qui fait foi, pas l'historique isole.
 */
export function levelStates(
  levels: Pick<Level, 'id' | 'position'>[],
  outcomes: Pick<LevelOutcome, 'levelId' | 'validated'>[],
): Map<string, LevelState> {
  const ordered = [...levels].sort((a, b) => a.position - b.position)
  const current = currentLevel(ordered, outcomes)
  const states = new Map<string, LevelState>()

  let reachedCurrent = false
  for (const level of ordered) {
    if (current && level.id === current.id) {
      reachedCurrent = true
      states.set(level.id, 'current')
    } else {
      states.set(level.id, reachedCurrent ? 'locked' : 'validated')
    }
  }

  return states
}

/** Numero du niveau en cours, a partir de 1. Null si la grille est terminee. */
export function currentLevelNumber(
  grid: Pick<Grid, 'levels'>,
  outcomes: Pick<LevelOutcome, 'levelId' | 'validated'>[],
): number | null {
  return currentLevel(grid.levels, outcomes)?.position ?? null
}

/**
 * Date de validation d'un niveau, s'il en a une.
 *
 * La premiere seance validee fait foi : rejouer un niveau deja valide ne
 * repousse pas sa date.
 */
export function validatedAt(
  levelId: string,
  outcomes: Pick<LevelOutcome, 'levelId' | 'validated' | 'startedAt'>[],
): string | null {
  const dates = outcomes
    .filter((o) => o.levelId === levelId && o.validated)
    .map((o) => o.startedAt)
    .sort()

  return dates[0] ?? null
}
