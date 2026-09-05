import { describe, expect, it } from 'vitest'

import {
  buildSetSlots,
  countRecorded,
  isLevelValidated,
  listFailures,
  nextSlotIndex,
  resolveResumeLevel,
  type PlannedLevel,
  type SetOutcome,
} from './progress'

function level(overrides: Partial<PlannedLevel> = {}): PlannedLevel {
  return {
    id: 'level-1',
    position: 1,
    name: 'Niveau 1',
    exercises: [
      {
        id: 'ex-a',
        exerciseName: 'Pompes',
        position: 1,
        sets: 2,
        reps: 10,
        timerMode: 'none',
        timerSeconds: null,
      },
      {
        id: 'ex-b',
        exerciseName: 'Gainage',
        position: 2,
        sets: 1,
        reps: null,
        timerMode: 'minimal',
        timerSeconds: 30,
      },
    ],
    ...overrides,
  }
}

function outcome(
  levelExerciseId: string,
  setIndex: number,
  success: boolean,
): SetOutcome {
  return { levelExerciseId, setIndex, success, repsDone: null, durationSeconds: null }
}

describe('buildSetSlots', () => {
  it('deroule les series exercice par exercice, dans l ordre', () => {
    const slots = buildSetSlots(level())
    expect(slots.map((s) => `${s.levelExerciseId}:${s.setIndex}`)).toEqual([
      'ex-a:1',
      'ex-a:2',
      'ex-b:1',
    ])
  })

  it('respecte la position, pas l ordre du tableau', () => {
    const inverted = level({
      exercises: [
        {
          id: 'ex-b',
          exerciseName: 'Gainage',
          position: 2,
          sets: 1,
          reps: null,
          timerMode: 'minimal',
          timerSeconds: 30,
        },
        {
          id: 'ex-a',
          exerciseName: 'Pompes',
          position: 1,
          sets: 1,
          reps: 10,
          timerMode: 'none',
          timerSeconds: null,
        },
      ],
    })
    expect(buildSetSlots(inverted).map((s) => s.levelExerciseId)).toEqual([
      'ex-a',
      'ex-b',
    ])
  })
})

describe('isLevelValidated', () => {
  it('valide quand toutes les series de tous les exercices sont reussies', () => {
    const outcomes = [
      outcome('ex-a', 1, true),
      outcome('ex-a', 2, true),
      outcome('ex-b', 1, true),
    ]
    expect(isLevelValidated(level(), outcomes)).toBe(true)
  })

  it('invalide des qu une seule serie echoue', () => {
    const outcomes = [
      outcome('ex-a', 1, true),
      outcome('ex-a', 2, false),
      outcome('ex-b', 1, true),
    ]
    expect(isLevelValidated(level(), outcomes)).toBe(false)
  })

  it('invalide quand une serie n a pas ete faite', () => {
    const outcomes = [outcome('ex-a', 1, true), outcome('ex-a', 2, true)]
    expect(isLevelValidated(level(), outcomes)).toBe(false)
  })

  it('n est jamais valide si le niveau est vide', () => {
    expect(isLevelValidated(level({ exercises: [] }), [])).toBe(false)
  })

  it('ignore les resultats d un exercice qui ne fait plus partie du niveau', () => {
    const outcomes = [
      outcome('ex-a', 1, true),
      outcome('ex-a', 2, true),
      outcome('ex-b', 1, true),
      outcome('ex-supprime', 1, false),
    ]
    expect(isLevelValidated(level(), outcomes)).toBe(true)
  })

  it('retient le dernier resultat enregistre pour une meme serie', () => {
    const outcomes = [
      outcome('ex-a', 1, false),
      outcome('ex-a', 1, true),
      outcome('ex-a', 2, true),
      outcome('ex-b', 1, true),
    ]
    expect(isLevelValidated(level(), outcomes)).toBe(true)
  })
})

describe('countRecorded', () => {
  it('compte les series renseignees, reussies ou non', () => {
    const outcomes = [outcome('ex-a', 1, true), outcome('ex-a', 2, false)]
    expect(countRecorded(level(), outcomes)).toBe(2)
  })
})

describe('listFailures', () => {
  it('ne renvoie que les series echouees', () => {
    const outcomes = [
      outcome('ex-a', 1, true),
      outcome('ex-a', 2, false),
      outcome('ex-b', 1, false),
    ]
    expect(listFailures(level(), outcomes).map((o) => o.levelExerciseId)).toEqual([
      'ex-a',
      'ex-b',
    ])
  })
})

describe('nextSlotIndex', () => {
  it('renvoie la premiere serie sans resultat', () => {
    const slots = buildSetSlots(level())
    expect(nextSlotIndex(slots, [outcome('ex-a', 1, true)])).toBe(1)
  })

  it('reprend le premier trou, meme si des series suivantes sont faites', () => {
    const slots = buildSetSlots(level())
    const outcomes = [outcome('ex-a', 1, true), outcome('ex-b', 1, true)]
    expect(nextSlotIndex(slots, outcomes)).toBe(1)
  })

  it('renvoie -1 quand tout est renseigne', () => {
    const slots = buildSetSlots(level())
    const outcomes = [
      outcome('ex-a', 1, true),
      outcome('ex-a', 2, false),
      outcome('ex-b', 1, true),
    ]
    expect(nextSlotIndex(slots, outcomes)).toBe(-1)
  })
})

describe('resolveResumeLevel', () => {
  const levels = [
    level({ id: 'l1', position: 1 }),
    level({ id: 'l2', position: 2 }),
    level({ id: 'l3', position: 3 }),
  ]

  it('demarre au premier niveau quand rien n est valide', () => {
    expect(resolveResumeLevel(levels, new Set())?.id).toBe('l1')
  })

  it('reprend au premier niveau non valide', () => {
    expect(resolveResumeLevel(levels, new Set(['l1']))?.id).toBe('l2')
  })

  it('ne saute pas un trou : un niveau non valide passe avant un valide', () => {
    // l1 non valide, l2 valide : on repart de l1.
    expect(resolveResumeLevel(levels, new Set(['l2']))?.id).toBe('l1')
  })

  it('renvoie null quand toute la grille est validee', () => {
    expect(resolveResumeLevel(levels, new Set(['l1', 'l2', 'l3']))).toBeNull()
  })

  it('renvoie null sur une grille vide', () => {
    expect(resolveResumeLevel([], new Set())).toBeNull()
  })

  it('se fie a la position, pas a l ordre du tableau', () => {
    const shuffled = [levels[2], levels[0], levels[1]]
    expect(resolveResumeLevel(shuffled, new Set())?.id).toBe('l1')
  })
})
