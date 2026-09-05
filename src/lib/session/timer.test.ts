import { describe, expect, it } from 'vitest'

import {
  URGENCY_THRESHOLD,
  displaySeconds,
  evaluateTimedSet,
  formatDuration,
  isTimerComplete,
  timerUrgency,
} from './timer'

describe('evaluateTimedSet — mode minimal', () => {
  it('reussit quand la duree tenue atteint l objectif', () => {
    expect(evaluateTimedSet('minimal', 30, 30).success).toBe(true)
  })

  it('reussit quand on tient plus longtemps que demande', () => {
    expect(evaluateTimedSet('minimal', 30, 42).success).toBe(true)
  })

  it('echoue a l arret anticipe', () => {
    const verdict = evaluateTimedSet('minimal', 30, 22)
    expect(verdict.success).toBe(false)
    expect(verdict.reason).toContain('22')
  })
})

describe('evaluateTimedSet — mode strict', () => {
  it('reussit quand on finit dans le temps imparti', () => {
    expect(evaluateTimedSet('strict', 15, 12).success).toBe(true)
  })

  it('reussit pile a la limite', () => {
    expect(evaluateTimedSet('strict', 15, 15).success).toBe(true)
  })

  it('echoue au depassement', () => {
    expect(evaluateTimedSet('strict', 15, 16).success).toBe(false)
  })
})

describe('evaluateTimedSet — robustesse', () => {
  it('arrondit les fractions de seconde', () => {
    expect(evaluateTimedSet('minimal', 30, 29.6).success).toBe(true)
    expect(evaluateTimedSet('minimal', 30, 29.4).success).toBe(false)
  })

  it('traite une duree negative comme zero', () => {
    expect(evaluateTimedSet('minimal', 10, -5).success).toBe(false)
    expect(evaluateTimedSet('strict', 10, -5).success).toBe(true)
  })
})

describe('displaySeconds', () => {
  it('decompte le temps restant', () => {
    expect(displaySeconds(30, 0)).toBe(30)
    expect(displaySeconds(30, 10)).toBe(20)
  })

  it('decompte aussi pour un chrono strict : combien de temps encore', () => {
    expect(displaySeconds(15, 7)).toBe(8)
  })

  it('ne descend pas sous zero, meme au depassement', () => {
    expect(displaySeconds(30, 45)).toBe(0)
    expect(displaySeconds(15, 20)).toBe(0)
  })
})

describe('timerUrgency', () => {
  it('reste a zero — donc vert — tant que le seuil n est pas franchi', () => {
    expect(timerUrgency(20, 0)).toBe(0)
    expect(timerUrgency(20, 10)).toBe(0)
    // Pile au seuil : encore vert.
    expect(timerUrgency(20, 20 * URGENCY_THRESHOLD)).toBe(0)
  })

  it('monte continument du seuil jusqu a l echeance', () => {
    // A mi-chemin entre 85 % et 100 % de 20 s, soit 18.5 s.
    expect(timerUrgency(20, 18.5)).toBeCloseTo(0.5)
  })

  it('atteint 1 a l echeance et y reste', () => {
    expect(timerUrgency(20, 20)).toBe(1)
    expect(timerUrgency(20, 35)).toBe(1)
  })

  it('ne descend pas sous zero pour une duree negative', () => {
    expect(timerUrgency(20, -5)).toBe(0)
  })

  it('traite une cible nulle comme deja urgente, sans diviser par zero', () => {
    expect(timerUrgency(0, 0)).toBe(1)
  })
})

describe('isTimerComplete', () => {
  it('signale la fin quand la duree cible est atteinte', () => {
    expect(isTimerComplete('minimal', 30, 29.9)).toBe(false)
    expect(isTimerComplete('minimal', 30, 30)).toBe(true)
  })
})

describe('formatDuration', () => {
  it('affiche les secondes en dessous d une minute', () => {
    expect(formatDuration(45)).toBe('45 s')
  })

  it('passe en minutes au-dela', () => {
    expect(formatDuration(65)).toBe('1:05')
    expect(formatDuration(180)).toBe('3:00')
  })
})
