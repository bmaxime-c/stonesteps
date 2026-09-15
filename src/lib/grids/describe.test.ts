import { describe, expect, it } from 'vitest'

import {
  copyName,
  describeLevelContent,
  describeRest,
  describeSets,
  initials,
  plural,
  shortDate,
} from './describe'
import type { LevelSet } from './model'

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

describe('plural', () => {
  it('accorde a partir de deux', () => {
    expect(plural(0, 'série')).toBe('0 série')
    expect(plural(1, 'série')).toBe('1 série')
    expect(plural(2, 'série')).toBe('2 séries')
  })

  it('accepte un pluriel irregulier', () => {
    expect(plural(3, 'niveau', 'niveaux')).toBe('3 niveaux')
  })
})

describe('initials', () => {
  it('prend l initiale des deux premiers mots', () => {
    expect(initials('Push Day')).toBe('PD')
    expect(initials('Pull & Core')).toBe('PC')
  })

  it('ecarte les mots d une seule lettre', () => {
    // « & » ne doit pas devenir une initiale.
    expect(initials('Legs & Skills')).toBe('LS')
  })

  it('retombe sur les deux premieres lettres d un mot unique', () => {
    expect(initials('Gainage')).toBe('GA')
  })

  it('ignore les parentheses', () => {
    expect(initials('(Test) Grille')).toBe('TG')
  })

  it('ne casse pas sur un nom vide', () => {
    expect(initials('')).toBe('')
  })
})

describe('describeSets', () => {
  it('liste les repetitions serie par serie', () => {
    expect(
      describeSets([
        set({ targetReps: 15 }),
        set({ targetReps: 15 }),
        set({ targetReps: 12 }),
      ]),
    ).toBe('3 séries · 15/15/12 reps')
  })

  it('resume un maintien', () => {
    const hold = set({ timerMode: 'minimal', timerSeconds: 30 })
    expect(describeSets([hold, hold])).toBe('2 séries · tenir 30s min')
  })

  it('resume une serie a finir en un temps donne', () => {
    const strict = set({ timerMode: 'strict', timerSeconds: 30, targetReps: 10 })
    expect(describeSets([strict])).toBe('1 série · 10 reps en 30s max')
  })

  it('ne casse pas sur un exercice sans serie', () => {
    expect(describeSets([])).toBe('Aucune série')
  })
})

describe('describeLevelContent', () => {
  it('compte exercices et series, avec l accord', () => {
    expect(describeLevelContent([{ sets: [set(), set()] }, { sets: [set()] }])).toBe(
      '2 exercices · 3 séries à ce niveau',
    )
    expect(describeLevelContent([{ sets: [set()] }])).toBe(
      '1 exercice · 1 série à ce niveau',
    )
  })
})

describe('describeRest', () => {
  it('dit quand le repos est desactive', () => {
    expect(describeRest(0)).toBe('sans repos')
    expect(describeRest(60)).toBe('repos 60s')
  })
})

describe('shortDate', () => {
  it('rend un jour et un mois', () => {
    expect(shortDate(new Date(2026, 7, 11, 12).toISOString())).toBe('11 août')
  })

  it('ne casse pas sur une date invalide', () => {
    expect(shortDate('pas une date')).toBe('')
  })
})

describe('copyName', () => {
  it('ajoute un suffixe explicite', () => {
    expect(copyName('Push Day')).toBe('Push Day (copie)')
  })

  it('numerote la copie d une copie', () => {
    expect(copyName('Push Day (copie)')).toBe('Push Day (copie 2)')
    expect(copyName('Push Day (copie 2)')).toBe('Push Day (copie 3)')
  })

  it('ne confond pas une parenthese quelconque avec un suffixe', () => {
    expect(copyName('Planche (gainage)')).toBe('Planche (gainage) (copie)')
  })

  it('ignore les blancs de bordure', () => {
    expect(copyName('  Push Day  ')).toBe('Push Day (copie)')
  })
})
