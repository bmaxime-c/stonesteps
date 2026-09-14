import { describe, expect, it } from 'vitest'

import {
  barHeight,
  chartScale,
  CHART_HEIGHT,
  CHART_WIDTH,
  linePath,
  stepPath,
} from './chart'

describe('chartScale', () => {
  it('etale les abscisses du premier au dernier point', () => {
    const scale = chartScale([1, 2, 3], 3)
    expect(scale.x(0)).toBe(14)
    expect(scale.x(2)).toBe(CHART_WIDTH - 14)
    expect(scale.x(1)).toBeCloseTo(CHART_WIDTH / 2)
  })

  it('centre un point unique', () => {
    expect(chartScale([5], 1).x(0)).toBe(CHART_WIDTH / 2)
  })

  it('fait toujours partir l echelle de zero', () => {
    // Une base tronquee exagererait les ecarts entre deux seances proches.
    const scale = chartScale([10, 12], 2)
    expect(scale.y(0)).toBe(CHART_HEIGHT - 16)
    expect(scale.y(12)).toBe(16)
  })

  it('ne divise pas par zero quand toutes les valeurs sont egales', () => {
    const scale = chartScale([0, 0], 2)
    expect(Number.isFinite(scale.y(0))).toBe(true)
  })

  it('supporte une serie vide', () => {
    const scale = chartScale([], 0)
    expect(scale.viewBox).toBe(`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`)
  })
})

describe('linePath', () => {
  it('relie les points dans l ordre', () => {
    expect(
      linePath([
        { x: 0, y: 10 },
        { x: 10, y: 20 },
      ]),
    ).toBe('M0 10 L10 20')
  })

  it('rend une chaine vide sans point', () => {
    expect(linePath([])).toBe('')
  })
})

describe('stepPath', () => {
  it('tient le niveau jusqu a la seance suivante', () => {
    // Horizontale d'abord, puis verticale : un niveau change d'un coup.
    expect(
      stepPath([
        { x: 0, y: 100 },
        { x: 50, y: 60 },
      ]),
    ).toBe('M0 100 L50 100 L50 60')
  })

  it('enchaine les marches', () => {
    const path = stepPath([
      { x: 0, y: 100 },
      { x: 50, y: 60 },
      { x: 100, y: 20 },
    ])
    expect(path).toBe('M0 100 L50 100 L50 60 L100 60 L100 20')
  })

  it('rend une chaine vide sans point', () => {
    expect(stepPath([])).toBe('')
  })
})

describe('barHeight', () => {
  it('proportionne au maximum', () => {
    expect(barHeight(5, 10, 100)).toBe(50)
    expect(barHeight(10, 10, 100)).toBe(100)
    expect(barHeight(0, 10, 100)).toBe(0)
  })

  it('ne divise pas par zero sur un histogramme vide', () => {
    expect(barHeight(0, 0, 100)).toBe(0)
  })
})
