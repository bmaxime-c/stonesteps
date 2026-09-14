/**
 * Geometrie des graphiques.
 *
 * Trois visualisations simples, tracees a la main en SVG : une librairie de
 * charts pesserait plus que ce qu'elle apporte, et imposerait son propre
 * habillage a une charte qui tient en quinze couleurs.
 *
 * Les fonctions sont pures et rendent des coordonnees : c'est ce qui permet de
 * verifier une courbe sans la regarder.
 */

export const CHART_WIDTH = 280
export const CHART_HEIGHT = 110
const PAD_X = 14
const PAD_Y = 16

export type Point = { x: number; y: number }

export type Scale = {
  width: number
  height: number
  viewBox: string
  /** Abscisse du i-eme point. Un point unique se place au centre. */
  x: (index: number) => number
  /** Ordonnee d'une valeur, bornee par l'echelle. */
  y: (value: number) => number
}

/**
 * Echelle commune a tous les graphiques de la page.
 *
 * Le bas de l'echelle descend a zero meme si toutes les valeurs sont plus
 * hautes : une courbe qui flotte sur une base tronquee exagere les ecarts.
 */
export function chartScale(values: number[], count: number): Scale {
  const max = values.length > 0 ? Math.max(...values) : 0
  const min = Math.min(0, ...values)
  const range = max - min || 1

  return {
    width: CHART_WIDTH,
    height: CHART_HEIGHT,
    viewBox: `0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`,
    x: (index) =>
      count <= 1
        ? CHART_WIDTH / 2
        : PAD_X + (CHART_WIDTH - 2 * PAD_X) * (index / (count - 1)),
    y: (value) =>
      CHART_HEIGHT - PAD_Y - (CHART_HEIGHT - 2 * PAD_Y) * ((value - min) / range),
  }
}

const round = (value: number) => Math.round(value * 100) / 100

/** Ligne brisee reliant les points, dans l'ordre. */
export function linePath(points: Point[]): string {
  if (points.length === 0) return ''
  return points
    .map(
      (point, index) => `${index === 0 ? 'M' : 'L'}${round(point.x)} ${round(point.y)}`,
    )
    .join(' ')
}

/**
 * Courbe en escalier : le niveau atteint tient jusqu'a la seance suivante.
 *
 * Relier deux seances par une diagonale laisserait croire a une progression
 * continue entre les deux, alors qu'un niveau change d'un coup.
 */
export function stepPath(points: Point[]): string {
  if (points.length === 0) return ''

  let path = `M${round(points[0].x)} ${round(points[0].y)}`
  for (let index = 1; index < points.length; index += 1) {
    path += ` L${round(points[index].x)} ${round(points[index - 1].y)}`
    path += ` L${round(points[index].x)} ${round(points[index].y)}`
  }
  return path
}

/** Hauteur d'une barre, en part du maximum. Zero rend une barre nulle. */
export function barHeight(value: number, max: number, maxPixels: number): number {
  if (max <= 0) return 0
  return Math.round((value / max) * maxPixels)
}
