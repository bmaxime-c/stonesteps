'use client'

import { useEffect, useState } from 'react'

import { startTimer, stopTimer } from './timers'

/**
 * Horloge de rendu.
 *
 * Renvoie l'instant courant et redeclenche le rendu tant que `active` est vrai.
 * Les fonctions de chrono, elles, restent pures : elles recoivent ce `now` et
 * ne lisent jamais l'horloge elles-memes.
 *
 * 200 ms : assez fin pour qu'un compte a rebours en secondes ne saute jamais
 * une valeur, assez lache pour ne pas rendre quarante fois par seconde.
 */
export function useNow(active: boolean, intervalMs = 200): number {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!active) return

    // La valeur n'est pas rafraichie ici : le premier tick s'en charge, et
    // 200 ms de retard au demarrage ne se voient pas sur un compteur en
    // secondes. C'est aussi ce qui evite un rendu en cascade des le montage.
    const handle = startTimer(() => setNow(Date.now()), intervalMs)
    return () => stopTimer(handle)
  }, [active, intervalMs])

  return now
}
