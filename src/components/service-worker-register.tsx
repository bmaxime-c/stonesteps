'use client'

import { useEffect } from 'react'

/**
 * Enregistre le service worker.
 *
 * En production uniquement : en developpement, un worker actif servirait une
 * coquille perimee a chaque rechargement et masquerait les modifications.
 *
 * Le worker ne met en cache que la coquille — page hors ligne et manifeste.
 * La seance, elle, survit a un rafraichissement par `sessionStorage` et par sa
 * route propre, pas par un cache reseau : du HTML authentifie mis en cache
 * resterait lisible apres une deconnexion.
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
