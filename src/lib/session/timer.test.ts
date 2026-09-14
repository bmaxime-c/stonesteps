import { describe, expect, it } from 'vitest'

import type { LevelSet } from '@/lib/grids/model'

import { elapsedSeconds, restView, timerFinalStatus, timerView } from './timer'

const T0 = 1_700_000_000_000

function set(over: Partial<LevelSet> = {}): LevelSet {
  return {
    id: 's',
    position: 1,
    targetReps: 10,
    timerMode: 'none',
    timerSeconds: null,
    ...over,
  }
}

/** Le temps est injecte : aucun test n'attend, aucun ne lit l'horloge. */
const at = (seconds: number) => T0 + seconds * 1000

describe('elapsedSeconds', () => {
  it('compte les secondes pleines ecoulees', () => {
    expect(elapsedSeconds(T0, at(0))).toBe(0)
    expect(elapsedSeconds(T0, T0 + 1999)).toBe(1)
    expect(elapsedSeconds(T0, at(12))).toBe(12)
  })

  it('ne descend jamais sous zero si l horloge recule', () => {
    expect(elapsedSeconds(T0, T0 - 5000)).toBe(0)
  })
})

describe('chrono minimal', () => {
  const hold = set({ timerMode: 'minimal', timerSeconds: 30 })

  it('compte a la hausse et remplit l anneau', () => {
    const view = timerView(hold, T0, at(15))
    expect(view.display).toBe(15)
    expect(view.progress).toBeCloseTo(0.5)
    expect(view.expired).toBe(false)
  })

  it('fait evoluer le statut en direct : echoue puis reussi puis depasse', () => {
    expect(timerView(hold, T0, at(29)).liveStatus).toBe('fail')
    expect(timerView(hold, T0, at(30)).liveStatus).toBe('success')
    expect(timerView(hold, T0, at(31)).liveStatus).toBe('surpass')
  })

  it('borne l anneau a un au-dela de l objectif', () => {
    expect(timerView(hold, T0, at(60)).progress).toBe(1)
  })
})

describe('chrono strict', () => {
  const strict = set({ timerMode: 'strict', timerSeconds: 40 })

  it('affiche le temps restant, pas le temps ecoule', () => {
    const view = timerView(strict, T0, at(15))
    expect(view.elapsed).toBe(15)
    expect(view.display).toBe(25)
  })

  it('reste neutre pendant l effort', () => {
    // Annoncer un verdict pendant un compte a rebours pousserait a s arreter
    // des qu il passe au vert.
    expect(timerView(strict, T0, at(5)).liveStatus).toBeNull()
    expect(timerView(strict, T0, at(39)).liveStatus).toBeNull()
  })

  it('se clot automatiquement en echec a zero', () => {
    const view = timerView(strict, T0, at(40))
    expect(view.expired).toBe(true)
    expect(view.display).toBe(0)
    expect(view.liveStatus).toBe('fail')
  })

  it('ne descend pas sous zero passe la limite', () => {
    expect(timerView(strict, T0, at(55)).display).toBe(0)
  })
})

describe('timerView sur une serie sans chrono', () => {
  it('leve : l ecran affiche un compteur ou un anneau, jamais les deux', () => {
    expect(() => timerView(set(), T0, at(5))).toThrow(/sans chrono/)
  })
})

describe('timerFinalStatus', () => {
  it('tranche a la validation en strict', () => {
    const strict = set({ timerMode: 'strict', timerSeconds: 40 })
    expect(timerFinalStatus(strict, 19, true)).toBe('surpass')
    expect(timerFinalStatus(strict, 39, true)).toBe('success')
    expect(timerFinalStatus(strict, 40, false)).toBe('fail')
  })

  it('tranche sur les secondes tenues en minimal', () => {
    const hold = set({ timerMode: 'minimal', timerSeconds: 20 })
    expect(timerFinalStatus(hold, 25, true)).toBe('surpass')
    expect(timerFinalStatus(hold, 19, true)).toBe('fail')
  })
})

describe('repos', () => {
  it('decompte jusqu a zero', () => {
    expect(restView(60, T0, at(0))).toEqual({ remaining: 60, done: false })
    expect(restView(60, T0, at(59))).toEqual({ remaining: 1, done: false })
    expect(restView(60, T0, at(60))).toEqual({ remaining: 0, done: true })
  })

  it('est deja termine quand le repos est desactive', () => {
    expect(restView(0, T0, at(0))).toEqual({ remaining: 0, done: true })
  })
})
