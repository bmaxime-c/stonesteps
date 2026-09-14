import { describe, expect, it } from 'vitest'

import { carriedLevels, sameLevel, unchangedPrefix } from './diff'
import type { Level, LevelSet } from './model'

function set(over: Partial<LevelSet> = {}): LevelSet {
  return {
    id: crypto.randomUUID(),
    position: 1,
    targetReps: 10,
    timerMode: 'none',
    timerSeconds: null,
    ...over,
  }
}

function level(position: number, reps: number[], exerciseId = 'x1'): Level {
  return {
    id: crypto.randomUUID(),
    position,
    exercises: [
      {
        id: crypto.randomUUID(),
        exerciseId,
        exerciseName: 'Pompes',
        position: 1,
        sets: reps.map((targetReps, index) => set({ position: index + 1, targetReps })),
      },
    ],
  }
}

describe('identite de deux niveaux', () => {
  it('ignore les identifiants de ligne', () => {
    // Republier recree les lignes : elles changent d'identifiant sans que rien
    // n'ait bouge pour l'utilisateur.
    expect(sameLevel(level(1, [10, 10]), level(1, [10, 10]))).toBe(true)
  })

  it('voit un objectif qui change', () => {
    expect(sameLevel(level(1, [10, 10]), level(1, [10, 12]))).toBe(false)
  })

  it('voit une serie ajoutee', () => {
    expect(sameLevel(level(1, [10]), level(1, [10, 10]))).toBe(false)
  })

  it('voit un exercice remplace', () => {
    expect(sameLevel(level(1, [10], 'x1'), level(1, [10], 'x2'))).toBe(false)
  })

  it('ne se laisse pas tromper par le nom de l exercice', () => {
    const before = level(1, [10])
    const after = level(1, [10])
    after.exercises[0].exerciseName = 'Pompes classiques'
    expect(sameLevel(before, after)).toBe(true)
  })

  it('voit un mode de chrono qui change', () => {
    const before = level(1, [10])
    const after = level(1, [10])
    after.exercises[0].sets[0] = set({
      targetReps: 10,
      timerMode: 'minimal',
      timerSeconds: 30,
    })
    expect(sameLevel(before, after)).toBe(false)
  })
})

describe('prefixe inchange', () => {
  const base = [level(1, [10]), level(2, [12]), level(3, [14])]

  it('rend toute la grille quand rien ne bouge', () => {
    expect(unchangedPrefix(base, [level(1, [10]), level(2, [12]), level(3, [14])])).toBe(
      3,
    )
  })

  it('rend tout quand on ajoute seulement a la fin', () => {
    const next = [level(1, [10]), level(2, [12]), level(3, [14]), level(4, [16])]
    expect(unchangedPrefix(base, next)).toBe(3)
  })

  it('s arrete a la premiere difference', () => {
    const next = [level(1, [10]), level(2, [99]), level(3, [14])]
    expect(unchangedPrefix(base, next)).toBe(1)
  })

  it('rend zero quand le premier niveau change', () => {
    expect(unchangedPrefix(base, [level(1, [99]), level(2, [12])])).toBe(0)
  })

  it('s arrete a la grille la plus courte', () => {
    expect(unchangedPrefix(base, [level(1, [10]), level(2, [12])])).toBe(2)
  })

  it('rend zero face a une grille vide', () => {
    expect(unchangedPrefix([], base)).toBe(0)
    expect(unchangedPrefix(base, [])).toBe(0)
  })

  it('lit les positions, pas l ordre du tableau', () => {
    const desordre = [base[2], base[0], base[1]]
    expect(
      unchangedPrefix(desordre, [level(1, [10]), level(2, [12]), level(3, [14])]),
    ).toBe(3)
  })
})

describe('niveaux reportes a la publication', () => {
  const base = [level(1, [10]), level(2, [12]), level(3, [14]), level(4, [16])]
  const identique = [level(1, [10]), level(2, [12]), level(3, [14]), level(4, [16])]

  it('ne donne jamais plus que ce qui etait franchi', () => {
    // Rien n'a change, mais l'utilisateur n'en etait qu'au niveau 3 : il garde
    // ses deux niveaux, pas quatre.
    expect(carriedLevels(base, identique, 3)).toBe(2)
  })

  it('ne reprend pas ce qui n a pas change', () => {
    const next = [level(1, [10]), level(2, [12]), level(3, [99]), level(4, [16])]
    // Le niveau 3 a change, l'utilisateur en etait au 4 : il garde 1 et 2.
    expect(carriedLevels(base, next, 4)).toBe(2)
  })

  it('remet a zero quand le premier niveau bouge', () => {
    const next = [level(1, [99]), level(2, [12])]
    expect(carriedLevels(base, next, 4)).toBe(0)
  })

  it('ne reporte rien sur une grille jamais jouee', () => {
    expect(carriedLevels(base, identique, 1)).toBe(0)
  })

  it('reporte tout sur une grille terminee dont rien ne bouge', () => {
    // Grille terminee : le niveau en cours vaut longueur + 1.
    expect(carriedLevels(base, identique, 5)).toBe(4)
  })

  it('ne descend jamais sous zero', () => {
    expect(carriedLevels(base, identique, 0)).toBe(0)
  })

  it('ne reporte rien depuis une grille neuve', () => {
    expect(carriedLevels([], base, 1)).toBe(0)
  })
})
