import { describe, expect, it } from 'vitest'

import type { LevelSet } from '@/lib/grids/model'

import { correctTimedResult, isCorrectable } from './correction'
import type { SetResult } from './model'

function set(over: Partial<LevelSet> = {}): LevelSet {
  return {
    id: 's',
    position: 1,
    targetReps: 8,
    timerMode: 'minimal',
    timerSeconds: 30,
    ...over,
  }
}

function result(over: Partial<SetResult> = {}): SetResult {
  return {
    levelSetId: 's',
    setIndex: 0,
    exerciseName: 'Gainage',
    setLabel: 'Série 1/1',
    unit: 's',
    targetValue: 30,
    actualValue: 30,
    status: 'success',
    ...over,
  }
}

describe('series corrigeables', () => {
  it('ne concerne que les series chronometrees', () => {
    expect(isCorrectable(set({ timerMode: 'minimal' }))).toBe(true)
    expect(isCorrectable(set({ timerMode: 'strict' }))).toBe(true)
    expect(isCorrectable(set({ timerMode: 'none', timerSeconds: null }))).toBe(false)
  })

  it('refuse une serie sans chrono', () => {
    expect(() =>
      correctTimedResult(set({ timerMode: 'none', timerSeconds: null }), result(), 5),
    ).toThrow()
  })
})

describe('correction d une serie minimal', () => {
  const hold = set({ timerMode: 'minimal', timerSeconds: 30 })

  it('recalcule le statut sur le temps reellement tenu', () => {
    // Tap tardif : le chrono dit 32s, l'utilisateur avait lache a 27s.
    const corrected = correctTimedResult(hold, result({ actualValue: 32 }), 27)
    expect(corrected.actualValue).toBe(27)
    expect(corrected.status).toBe('fail')
  })

  it('peut aussi relever le temps', () => {
    const corrected = correctTimedResult(
      hold,
      result({ actualValue: 28, status: 'fail' }),
      31,
    )
    expect(corrected.status).toBe('surpass')
  })

  it('ne descend jamais sous zero', () => {
    expect(correctTimedResult(hold, result(), -3).actualValue).toBe(0)
  })

  it('garde le reste du resultat intact', () => {
    const corrected = correctTimedResult(hold, result(), 30)
    expect(corrected).toEqual(result())
  })
})

describe('correction d une serie strict', () => {
  const burst = set({ timerMode: 'strict', timerSeconds: 40 })

  it('rattrape une serie close d office mais finie a temps', () => {
    // Cloture automatique : 40s, echec. La serie etait finie en 35s.
    const closed = result({ actualValue: 40, targetValue: 40, status: 'fail' })
    const corrected = correctTimedResult(burst, closed, 35)
    expect(corrected.actualValue).toBe(35)
    expect(corrected.status).toBe('success')
  })

  it('reste en echec a la limite', () => {
    expect(correctTimedResult(burst, result(), 40).status).toBe('fail')
  })

  it('borne la valeur a la limite', () => {
    expect(correctTimedResult(burst, result(), 55).actualValue).toBe(40)
  })

  it('passe en depasse sous la moitie de la limite', () => {
    expect(correctTimedResult(burst, result(), 19).status).toBe('surpass')
  })
})
