import { describe, expect, it } from 'vitest'

import type { LevelSet } from '@/lib/grids/model'

import { compareStatus, setStatus, strictStatus } from './status'

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

describe('serie sans chrono', () => {
  it('compare les reps effectuees a l objectif', () => {
    expect(setStatus(set(), { value: 10 })).toBe('success')
    expect(setStatus(set(), { value: 11 })).toBe('surpass')
    expect(setStatus(set(), { value: 9 })).toBe('fail')
  })

  it('traite zero rep comme un echec, pas comme une absence', () => {
    expect(setStatus(set(), { value: 0 })).toBe('fail')
  })

  it('reussit une serie dont l objectif est zero', () => {
    expect(setStatus(set({ targetReps: 0 }), { value: 0 })).toBe('success')
  })
})

describe('serie minimal — tenir au moins N secondes', () => {
  const hold = set({ timerMode: 'minimal', timerSeconds: 30, targetReps: 99 })

  it('compare les secondes tenues a l objectif', () => {
    expect(setStatus(hold, { value: 30 })).toBe('success')
    expect(setStatus(hold, { value: 45 })).toBe('surpass')
    expect(setStatus(hold, { value: 29 })).toBe('fail')
  })

  it('ignore targetReps : la valeur n est lue nulle part', () => {
    const autre = set({ timerMode: 'minimal', timerSeconds: 30, targetReps: 1 })
    expect(setStatus(autre, { value: 30 })).toBe('success')
  })
})

describe('serie strict — finir en au plus N secondes', () => {
  const strict = set({ timerMode: 'strict', timerSeconds: 40 })

  it('reussit quand la serie est terminee avant la limite', () => {
    expect(setStatus(strict, { value: 39, completed: true })).toBe('success')
  })

  it('depasse sous la moitie de la limite, strictement', () => {
    expect(setStatus(strict, { value: 19, completed: true })).toBe('surpass')
    expect(setStatus(strict, { value: 20, completed: true })).toBe('success')
  })

  it('echoue quand la limite est atteinte sans validation', () => {
    expect(setStatus(strict, { value: 40, completed: false })).toBe('fail')
  })

  it('echoue meme validee si la limite est atteinte', () => {
    // Cloture automatique : le chrono tranche, pas l utilisateur.
    expect(setStatus(strict, { value: 40, completed: true })).toBe('fail')
    expect(setStatus(strict, { value: 41, completed: true })).toBe('fail')
  })

  it('echoue si l utilisateur n a pas valide, quel que soit le temps', () => {
    expect(strictStatus(5, 40, false)).toBe('fail')
  })

  it('considere la serie validee par defaut', () => {
    expect(setStatus(strict, { value: 10 })).toBe('surpass')
  })
})

describe('compareStatus', () => {
  it('est la comparaison partagee par les series sans chrono et minimal', () => {
    expect(compareStatus(5, 4)).toBe('surpass')
    expect(compareStatus(4, 4)).toBe('success')
    expect(compareStatus(3, 4)).toBe('fail')
  })
})
