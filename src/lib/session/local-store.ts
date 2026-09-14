/**
 * Etat de la seance en cours, conserve dans sessionStorage.
 *
 * La seance se deroule cote client et n'ecrit en base qu'a la fin. Entre les
 * deux, un rafraichissement accidentel — le telephone en poche, un doigt sur
 * l'ecran entre deux series — ne doit pas faire perdre la progression.
 *
 * sessionStorage et non localStorage : la seance appartient a l'onglet en
 * cours. Deux onglets ouverts sur la meme grille ne se marchent pas dessus, et
 * fermer l'onglet abandonne la seance, ce qui est le comportement voulu — une
 * seance interrompue n'est pas sauvegardee.
 */

import type { SetResult } from './model'

export type RunStage = 'set' | 'rest' | 'summary'

export type StoredRun = {
  gridId: string
  levelId: string
  startedAt: number
  cursor: number
  results: SetResult[]
  stage: RunStage
  restStartedAt: number | null
  timerStartedAt: number | null
  /** Renseigne une fois la seance consolidee en base. */
  sessionValidated: boolean | null
}

const PREFIX = 'stonesteps.run.'

function key(gridId: string): string {
  return `${PREFIX}${gridId}`
}

/**
 * sessionStorage peut lever : navigation privee, stockage bloque, quota
 * atteint. Perdre la reprise apres rafraichissement est genant, planter au
 * milieu d'une serie l'est beaucoup plus.
 */
function safely<T>(action: () => T, fallback: T): T {
  try {
    return action()
  } catch {
    return fallback
  }
}

export function loadRun(gridId: string, levelId: string): StoredRun | null {
  if (typeof window === 'undefined') return null

  return safely(() => {
    const raw = window.sessionStorage.getItem(key(gridId))
    if (!raw) return null

    const parsed = JSON.parse(raw) as StoredRun
    // Le niveau en cours a pu changer depuis — une seance validee ailleurs,
    // une grille modifiee. On ne reprend que ce qui correspond encore.
    if (parsed.gridId !== gridId || parsed.levelId !== levelId) return null
    return parsed
  }, null)
}

export function saveRun(run: StoredRun): void {
  if (typeof window === 'undefined') return
  safely(
    () => window.sessionStorage.setItem(key(run.gridId), JSON.stringify(run)),
    undefined,
  )
}

export function clearRun(gridId: string): void {
  if (typeof window === 'undefined') return
  safely(() => window.sessionStorage.removeItem(key(gridId)), undefined)
}
