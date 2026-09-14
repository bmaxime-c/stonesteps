'use client'

import { useEffect } from 'react'

type WakeLockSentinel = { release: () => Promise<void> }
type WakeLockNavigator = Navigator & {
  wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinel> }
}

/**
 * Empeche l'ecran de s'eteindre pendant la seance.
 *
 * Le seul ecran qui le justifie : on y repose le telephone entre deux series,
 * et un ecran eteint au milieu d'un gainage oblige a le rallumer d'une main
 * qui n'est pas libre.
 *
 * Le verrou est relache par le navigateur des que l'onglet passe en arriere-
 * plan : on le redemande au retour, sinon il ne revient jamais.
 */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active) return

    const nav = navigator as WakeLockNavigator
    if (!nav.wakeLock) return

    let sentinel: WakeLockSentinel | null = null
    let cancelled = false

    const acquire = async () => {
      try {
        const lock = await nav.wakeLock!.request('screen')
        if (cancelled) {
          void lock.release()
          return
        }
        sentinel = lock
      } catch {
        // Refus de l'utilisateur, batterie faible, onglet masque : la seance
        // se joue tres bien sans.
      }
    }

    const onVisibility = () => {
      if (document.visibilityState === 'visible') void acquire()
    }

    void acquire()
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisibility)
      void sentinel?.release().catch(() => {})
    }
  }, [active])
}

/** Retour haptique bref. Sans effet la ou l'API n'existe pas. */
export function vibrate(pattern: number | number[]): void {
  if (typeof navigator === 'undefined') return
  try {
    navigator.vibrate?.(pattern)
  } catch {
    // Certains navigateurs levent quand le geste utilisateur manque.
  }
}
