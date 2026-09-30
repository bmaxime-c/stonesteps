import { describe, expect, it } from 'vitest'

import {
  canDeleteExercise,
  findCategoryByName,
  groupByCategory,
  nextCategoryPosition,
  validateCategoryName,
  validateExerciseName,
} from './catalog'
import type { CatalogExercise, ExerciseCategory } from './model'

const push: ExerciseCategory = { id: 'c1', name: 'Poussée', position: 1 }
const legs: ExerciseCategory = { id: 'c3', name: 'Jambes', position: 3 }
const pull: ExerciseCategory = { id: 'c2', name: 'Tirage', position: 2 }

function exercise(id: string, category: ExerciseCategory): CatalogExercise {
  return { id, name: id, category, imageUrl: null }
}

describe('nom d exercice', () => {
  it('refuse un nom vide ou blanc', () => {
    expect(validateExerciseName('   ')).toBe("Donne un nom à l'exercice.")
  })

  it('refuse un nom trop long', () => {
    expect(validateExerciseName('a'.repeat(81))).toMatch(/80 caractères/)
  })

  it('accepte un nom borne, espaces de bord ignores', () => {
    expect(validateExerciseName(`  ${'a'.repeat(80)}  `)).toBeNull()
  })
})

describe('nom de categorie', () => {
  it('refuse un nom vide', () => {
    expect(validateCategoryName('')).toBe('Donne un nom à la nouvelle catégorie.')
  })

  it('refuse un nom trop long', () => {
    expect(validateCategoryName('a'.repeat(41))).toMatch(/40 caractères/)
  })

  it('accepte un nom valide', () => {
    expect(validateCategoryName('Mobilité')).toBeNull()
  })
})

describe('categorie existante par nom', () => {
  it('ignore la casse et les espaces de bord', () => {
    expect(findCategoryByName([push, legs], '  jambes ')).toBe(legs)
  })

  it('rend null quand aucune ne correspond', () => {
    expect(findCategoryByName([push, legs], 'Mobilité')).toBeNull()
  })
})

describe('position d une nouvelle categorie', () => {
  it('se range apres la plus haute', () => {
    expect(nextCategoryPosition([push, legs, pull])).toBe(4)
  })

  it('vaut 1 sans categorie', () => {
    expect(nextCategoryPosition([])).toBe(1)
  })
})

describe('suppression d un exercice', () => {
  it('est permise pour un exercice inutilise', () => {
    expect(canDeleteExercise({ inUse: false })).toBe(true)
  })

  it('est refusee pour un exercice utilise', () => {
    expect(canDeleteExercise({ inUse: true })).toBe(false)
  })
})

describe('regroupement par categorie', () => {
  it('suit l ordre des categories et garde l ordre recu dedans', () => {
    const sections = groupByCategory([
      exercise('squat', legs),
      exercise('pompes', push),
      exercise('fentes', legs),
      exercise('dips', push),
    ])

    expect(sections.map((section) => section.category.id)).toEqual(['c1', 'c3'])
    expect(sections[0].exercises.map((item) => item.id)).toEqual(['pompes', 'dips'])
    expect(sections[1].exercises.map((item) => item.id)).toEqual(['squat', 'fentes'])
  })

  it('n affiche pas les categories vides', () => {
    expect(groupByCategory([exercise('pompes', push)])).toHaveLength(1)
  })

  it('rend une liste vide sans exercice', () => {
    expect(groupByCategory([])).toEqual([])
  })
})
