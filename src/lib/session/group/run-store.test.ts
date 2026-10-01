import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { clearGroupRun, type GroupRun, loadGroupRun, saveGroupRun } from './run-store'

function run(over: Partial<GroupRun> = {}): GroupRun {
  return {
    roomId: 'r1',
    levelId: 'l2',
    startedAt: 1000,
    results: [],
    timer: null,
    saved: false,
    ...over,
  }
}

beforeEach(() => window.sessionStorage.clear())
afterEach(() => vi.restoreAllMocks())

describe('stockage local d une seance de groupe', () => {
  it('relit la seance rangee pour ce salon et ce niveau', () => {
    saveGroupRun(run({ startedAt: 42 }))

    expect(loadGroupRun('r1', 'l2')).toEqual(run({ startedAt: 42 }))
  })

  it('une cle par salon : deux salons ne se marchent pas dessus', () => {
    saveGroupRun(run({ roomId: 'r1', startedAt: 1 }))
    saveGroupRun(run({ roomId: 'r2', startedAt: 2 }))

    expect(loadGroupRun('r1', 'l2')?.startedAt).toBe(1)
    expect(loadGroupRun('r2', 'l2')?.startedAt).toBe(2)
  })

  it('ignore une seance rangee pour un autre niveau', () => {
    saveGroupRun(run({ levelId: 'l1' }))

    expect(loadGroupRun('r1', 'l2')).toBeNull()
  })

  it('s efface', () => {
    saveGroupRun(run())
    clearGroupRun('r1')

    expect(loadGroupRun('r1', 'l2')).toBeNull()
  })

  it('un stockage bloque ne fait rien planter', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloque')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bloque')
    })

    expect(() => saveGroupRun(run())).not.toThrow()
    expect(loadGroupRun('r1', 'l2')).toBeNull()
  })
})
