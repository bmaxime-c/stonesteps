'use client'

import { useEffect } from 'react'

/**
 * Empeche l'ecran de s'eteindre pendant la seance.
 *
 * Sans cela, le telephone se verrouille entre deux series et il faut le
 * reveiller a chaque fois, les mains moites. L'API n'existe pas partout et le
 * verrou saute des que l'onglet passe en arriere-plan : on le reprend au
 * retour, et l'absence de support n'est pas une erreur.
 */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active) return
    if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) return

    let sentinel: WakeLockSentinel | null = null
    let cancelled = false

    const acquire = async () => {
      try {
        const lock = await navigator.wakeLock.request('screen')
        if (cancelled) {
          await lock.release()
          return
        }
        sentinel = lock
      } catch {
        // Refus du navigateur, batterie faible, onglet masque : sans
        // consequence, la seance continue.
      }
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' && sentinel === null) {
        void acquire()
      }
    }

    void acquire()
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisibilityChange)
      void sentinel?.release().catch(() => {})
      sentinel = null
    }
  }, [active])
}
