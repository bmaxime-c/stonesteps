import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  runningTimerCount,
  startDelay,
  startTimer,
  stopAllTimers,
  stopDelay,
  stopTimer,
} from './timers'

afterEach(() => {
  stopAllTimers()
  vi.useRealTimers()
})

describe('registre de minuteurs', () => {
  it('tient le compte des intervalles en cours', () => {
    vi.useFakeTimers()
    expect(runningTimerCount()).toBe(0)

    const a = startTimer(() => {}, 100)
    startTimer(() => {}, 100)
    expect(runningTimerCount()).toBe(2)

    stopTimer(a)
    expect(runningTimerCount()).toBe(1)
  })

  it('arrete tout d un seul appel', () => {
    vi.useFakeTimers()
    const tick = vi.fn()
    startTimer(tick, 100)
    startTimer(tick, 100)

    vi.advanceTimersByTime(250)
    const before = tick.mock.calls.length
    expect(before).toBeGreaterThan(0)

    stopAllTimers()
    expect(runningTimerCount()).toBe(0)

    // Aucun intervalle ne survit a la sortie de seance.
    vi.advanceTimersByTime(1000)
    expect(tick.mock.calls.length).toBe(before)
  })

  it('supporte un arret deja effectue', () => {
    vi.useFakeTimers()
    const handle = startTimer(() => {}, 100)
    stopTimer(handle)
    expect(() => stopTimer(handle)).not.toThrow()
    expect(runningTimerCount()).toBe(0)
  })
})

describe('delais a declenchement unique', () => {
  it('declenche une fois puis se retire du registre', () => {
    vi.useFakeTimers()
    const fired = vi.fn()
    startDelay(fired, 500)
    expect(runningTimerCount()).toBe(1)

    vi.advanceTimersByTime(500)
    expect(fired).toHaveBeenCalledTimes(1)
    expect(runningTimerCount()).toBe(0)

    vi.advanceTimersByTime(5000)
    expect(fired).toHaveBeenCalledTimes(1)
  })

  it('s annule avant echeance', () => {
    vi.useFakeTimers()
    const fired = vi.fn()
    stopDelay(startDelay(fired, 500))

    vi.advanceTimersByTime(1000)
    expect(fired).not.toHaveBeenCalled()
    expect(runningTimerCount()).toBe(0)
  })

  it('est emporte par stopAllTimers', () => {
    vi.useFakeTimers()
    const fired = vi.fn()
    startDelay(fired, 500)
    startTimer(() => {}, 100)

    stopAllTimers()
    expect(runningTimerCount()).toBe(0)

    vi.advanceTimersByTime(2000)
    expect(fired).not.toHaveBeenCalled()
  })
})
