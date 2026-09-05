'use client'

import { useEffect } from 'react'

/**
 * Enregistre le service worker.
 *
 * Phase 1 : il ne met en cache que la coquille de l'application, pour que le
 * lancement fonctionne sans reseau. La mise en cache des donnees de seance et
 * la file de synchronisation arrivent en phase 3, la ou elles servent.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return
    if (!('serviceWorker' in navigator)) return

    const register = () => {
      navigator.serviceWorker.register('/sw.js').catch((error) => {
        console.error('Enregistrement du service worker impossible', error)
      })
    }

    // Apres le chargement : ne pas concurrencer le rendu initial.
    if (document.readyState === 'complete') {
      register()
    } else {
      window.addEventListener('load', register, { once: true })
      return () => window.removeEventListener('load', register)
    }
  }, [])

  return null
}
