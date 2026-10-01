/**
 * Seance de groupe en cours, conservee dans sessionStorage.
 *
 * Meme parti que la seance solo (src/lib/session/local-store.ts) : les
 * resultats restent sur l'appareil jusqu'a la fin, et un rafraichissement ne
 * les perd pas. La position, elle, vit dans le salon : on ne range ici que ce
 * qui est a soi.
 *
 * Une cle par salon : deux salons ouverts dans deux onglets ne se melangent
 * pas, et une seance solo sur la meme grille non plus.
 */

import type { SetResult } from '@/lib/session/model'

export type GroupRun = {
  roomId: string
  levelId: string
  startedAt: number
  /** Series jouees soi-meme, dans l'ordre du niveau. */
  results: SetResult[]
  /** Chrono local de la serie du curseur, tant qu'elle se joue. */
  timer: { cursor: number; startedAt: number } | null
  /**
   * Rang de la serie jouee dont la declaration n'est pas encore acceptee par
   * le salon : en correction, ou en route. Null une fois acceptee.
   */
  undeclared: number | null
  /** La seance est enregistree en base : on ne l'enregistre pas deux fois. */
  saved: boolean
}

const PREFIX = 'stonesteps.room.'

function key(roomId: string): string {
  return `${PREFIX}${roomId}`
}

/** sessionStorage peut lever : on perd la reprise, pas la seance. */
function safely<T>(action: () => T, fallback: T): T {
  try {
    return action()
  } catch {
    return fallback
  }
}

export function loadGroupRun(roomId: string, levelId: string): GroupRun | null {
  if (typeof window === 'undefined') return null

  return safely(() => {
    const raw = window.sessionStorage.getItem(key(roomId))
    if (!raw) return null

    const parsed = JSON.parse(raw) as GroupRun
    if (parsed.roomId !== roomId || parsed.levelId !== levelId) return null
    return { ...parsed, undeclared: parsed.undeclared ?? null }
  }, null)
}

export function saveGroupRun(run: GroupRun): void {
  if (typeof window === 'undefined') return
  safely(
    () => window.sessionStorage.setItem(key(run.roomId), JSON.stringify(run)),
    undefined,
  )
}

export function clearGroupRun(roomId: string): void {
  if (typeof window === 'undefined') return
  safely(() => window.sessionStorage.removeItem(key(roomId)), undefined)
}
