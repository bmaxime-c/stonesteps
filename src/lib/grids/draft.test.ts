import { describe, expect, it } from 'vitest'

import {
  addExercise,
  addLevel,
  addSet,
  cycleTimerMode,
  duplicatePreviousLevel,
  emptyGrid,
  fromGrid,
  newSet,
  removeExercise,
  removeLevel,
  removeSet,
  showsReps,
  showsSeconds,
  stepReps,
  stepRest,
  stepSeconds,
  toGridDraft,
  updateSet,
  type EditableGrid,
} from './draft'
import type { GridVersion } from './model'
import { isGridValid } from './validation'

function withOneExercise(): EditableGrid {
  return addExercise(emptyGrid(), 0, { exerciseId: 'x1', exerciseName: 'Pompes' })
}

describe('creation', () => {
  it('commence avec un niveau vide', () => {
    const grid = emptyGrid()
    expect(grid.levels).toHaveLength(1)
    expect(grid.levels[0].exercises).toEqual([])
  })

  it('charge une version existante sans perdre ses reglages', () => {
    const source: GridVersion = {
      id: 'v1',
      version: 2,
      status: 'published',
      carriedLevels: 0,
      name: 'Push Day',
      accentColor: '#22E1FF',
      restSeconds: 90,
      levels: [
        {
          id: 'l1',
          position: 1,
          exercises: [
            {
              id: 'e1',
              exerciseId: 'x1',
              exerciseName: 'Pompes',
              position: 1,
              sets: [
                {
                  id: 's1',
                  position: 1,
                  targetReps: 12,
                  timerMode: 'none',
                  timerSeconds: null,
                },
              ],
            },
          ],
        },
      ],
    }

    const grid = fromGrid(source)
    expect(grid.name).toBe('Push Day')
    expect(grid.restSeconds).toBe(90)
    expect(grid.levels[0].exercises[0].sets[0].targetReps).toBe(12)
  })

  it('produit une forme que la validation accepte', () => {
    const grid = withOneExercise()
    expect(isGridValid(toGridDraft({ ...grid, name: 'Push Day' }))).toBe(true)
  })
})

describe('niveaux', () => {
  it('empile un niveau vide', () => {
    const grid = addLevel(emptyGrid())
    expect(grid.levels).toHaveLength(2)
    expect(grid.levels[1].exercises).toEqual([])
  })

  it('refuse de supprimer le dernier niveau', () => {
    const grid = emptyGrid()
    expect(removeLevel(grid, 0).levels).toHaveLength(1)
  })

  it('supprime un niveau quand il en reste un autre', () => {
    const grid = addLevel(withOneExercise())
    const after = removeLevel(grid, 1)
    expect(after.levels).toHaveLength(1)
    expect(after.levels[0].exercises).toHaveLength(1)
  })

  it('duplique le niveau precedent a l identique', () => {
    const grid = addLevel(withOneExercise())
    const after = duplicatePreviousLevel(grid, 1)

    expect(after.levels[1].exercises).toHaveLength(1)
    expect(after.levels[1].exercises[0].exerciseName).toBe('Pompes')
    expect(after.levels[1].exercises[0].sets[0].targetReps).toBe(10)
  })

  it('donne des cles distinctes a la copie', () => {
    // Sans cela, editer la copie modifierait l'affichage de l'original.
    const grid = duplicatePreviousLevel(addLevel(withOneExercise()), 1)
    const [source, copy] = grid.levels
    expect(copy.exercises[0].key).not.toBe(source.exercises[0].key)
    expect(copy.exercises[0].sets[0].key).not.toBe(source.exercises[0].sets[0].key)
  })

  it('ne fait rien sur le premier niveau', () => {
    const grid = withOneExercise()
    expect(duplicatePreviousLevel(grid, 0)).toEqual(grid)
  })
})

describe('exercices et series', () => {
  it('ajoute un exercice avec une serie par defaut', () => {
    const grid = withOneExercise()
    expect(grid.levels[0].exercises[0].sets).toHaveLength(1)
    expect(grid.levels[0].exercises[0].sets[0]).toMatchObject({
      targetReps: 10,
      timerMode: 'none',
      timerSeconds: null,
    })
  })

  it('retire un exercice', () => {
    const grid = addExercise(withOneExercise(), 0, {
      exerciseId: 'x2',
      exerciseName: 'Dips',
    })
    expect(removeExercise(grid, 0, 0).levels[0].exercises[0].exerciseName).toBe('Dips')
  })

  it('duplique la derniere serie a l ajout', () => {
    let grid = withOneExercise()
    grid = updateSet(grid, 0, 0, 0, (set) => ({
      ...set,
      targetReps: 15,
      timerMode: 'strict',
      timerSeconds: 45,
    }))
    grid = addSet(grid, 0, 0)

    const sets = grid.levels[0].exercises[0].sets
    expect(sets).toHaveLength(2)
    expect(sets[1]).toMatchObject({
      targetReps: 15,
      timerMode: 'strict',
      timerSeconds: 45,
    })
    expect(sets[1].key).not.toBe(sets[0].key)
  })

  it('retire une serie', () => {
    const grid = addSet(withOneExercise(), 0, 0)
    expect(removeSet(grid, 0, 0, 0).levels[0].exercises[0].sets).toHaveLength(1)
  })
})

describe('cycle des modes de chrono', () => {
  it('tourne sans chrono, tenir au moins, faire en max', () => {
    const a = newSet()
    const b = cycleTimerMode(a)
    const c = cycleTimerMode(b)
    const d = cycleTimerMode(c)

    expect(a.timerMode).toBe('none')
    expect(b.timerMode).toBe('minimal')
    expect(c.timerMode).toBe('strict')
    expect(d.timerMode).toBe('none')
  })

  it('pose une duree en entrant dans un mode chronometre', () => {
    expect(cycleTimerMode(newSet()).timerSeconds).toBe(30)
  })

  it('retire la duree en revenant a sans chrono', () => {
    const strict = cycleTimerMode(cycleTimerMode(newSet()))
    expect(cycleTimerMode(strict).timerSeconds).toBeNull()
  })

  it('conserve la duree reglee d un mode a l autre', () => {
    let set = cycleTimerMode(newSet())
    set = stepSeconds(set, 2)
    expect(cycleTimerMode(set).timerSeconds).toBe(40)
  })
})

describe('pas de reglage', () => {
  it('descend les repetitions sans passer sous zero', () => {
    let set = newSet({ targetReps: 1 })
    set = stepReps(set, -1)
    expect(set.targetReps).toBe(0)
    expect(stepReps(set, -1).targetReps).toBe(0)
  })

  it('regle les secondes par pas de cinq, plancher a cinq', () => {
    const set = newSet({ timerMode: 'minimal', timerSeconds: 10 })
    expect(stepSeconds(set, 1).timerSeconds).toBe(15)
    expect(stepSeconds(set, -1).timerSeconds).toBe(5)
    expect(
      stepSeconds(newSet({ timerMode: 'minimal', timerSeconds: 5 }), -1).timerSeconds,
    ).toBe(5)
  })

  it('ne regle pas les secondes d une serie sans chrono', () => {
    const set = newSet()
    expect(stepSeconds(set, 1)).toEqual(set)
  })

  it('regle le repos par pas de quinze, entre zero et trois cents', () => {
    const grid = emptyGrid()
    expect(stepRest(grid, 1).restSeconds).toBe(30)
    expect(stepRest({ ...grid, restSeconds: 0 }, -1).restSeconds).toBe(0)
    expect(stepRest({ ...grid, restSeconds: 300 }, 1).restSeconds).toBe(300)
  })
})

describe('champs visibles', () => {
  it('masque le pas de repetitions en mode tenir au moins', () => {
    // La valeur n'est lue nulle part : la laisser visible ferait saisir une
    // valeur morte.
    expect(showsReps(newSet({ timerMode: 'minimal' }))).toBe(false)
    expect(showsReps(newSet({ timerMode: 'none' }))).toBe(true)
    expect(showsReps(newSet({ timerMode: 'strict' }))).toBe(true)
  })

  it('n affiche les secondes qu en mode chronometre', () => {
    expect(showsSeconds(newSet({ timerMode: 'none' }))).toBe(false)
    expect(showsSeconds(newSet({ timerMode: 'minimal' }))).toBe(true)
    expect(showsSeconds(newSet({ timerMode: 'strict' }))).toBe(true)
  })
})
