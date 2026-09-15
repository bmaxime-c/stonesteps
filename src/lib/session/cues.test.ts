import { describe, expect, it } from 'vitest'

import { beepOffsets, cueSchedule, cuesBetween, warningWindow } from './cues'

describe('fenetre d annonce', () => {
  it('vaut un pourcentage de la cible', () => {
    expect(warningWindow(40, 15)).toBe(6)
    expect(warningWindow(120, 15)).toBe(18)
  })

  it('ne descend pas sous zero', () => {
    expect(warningWindow(40, 0)).toBe(0)
    expect(warningWindow(0, 15)).toBe(0)
  })
})

describe('moments de bip', () => {
  it('se resserrent a l approche', () => {
    // Une par seconde, puis deux, puis quatre : l'oreille entend
    // l'acceleration sans avoir a compter.
    expect(beepOffsets(6)).toEqual([6, 5, 4, 3, 2.5, 2, 1.5, 1, 0.75, 0.5, 0.25])
  })

  it('ne sortent jamais de la fenetre', () => {
    expect(beepOffsets(2).every((offset) => offset <= 2)).toBe(true)
    expect(beepOffsets(2)).toEqual([2, 1.5, 1, 0.75, 0.5, 0.25])
  })

  it('tiennent sur une fenetre tres courte', () => {
    expect(beepOffsets(0.5)).toEqual([0.5, 0.25])
  })

  it('rendent une liste vide sans fenetre', () => {
    expect(beepOffsets(0)).toEqual([])
    expect(beepOffsets(-1)).toEqual([])
  })

  it('ne repetent pas un meme instant', () => {
    const offsets = beepOffsets(10)
    expect(new Set(offsets).size).toBe(offsets.length)
  })

  it('vont du plus loin au plus proche', () => {
    const offsets = beepOffsets(8)
    expect([...offsets].sort((a, b) => b - a)).toEqual(offsets)
  })
})

describe('programme de reperes', () => {
  it('place les bips avant la bascule, en secondes ecoulees', () => {
    const schedule = cueSchedule('strict', 40, 15)
    expect(schedule?.end).toBe(40)
    // Fenetre de 6 s : le premier bip tombe a 34 s ecoulees.
    expect(schedule?.beeps[0]).toBe(34)
    expect(schedule?.beeps.at(-1)).toBe(39.75)
  })

  it('vaut aussi en minimal, ou la bascule est la cible atteinte', () => {
    // Le chrono monte au lieu de descendre, mais le moment qui compte est le
    // meme : celui ou la serie bascule.
    expect(cueSchedule('minimal', 30, 20)?.end).toBe(30)
  })

  it('ne programme rien sans chrono', () => {
    expect(cueSchedule('none', 40, 15)).toBeNull()
  })

  it('ne programme rien sur une cible nulle', () => {
    expect(cueSchedule('strict', 0, 15)).toBeNull()
  })
})

describe('reperes franchis entre deux instants', () => {
  const schedule = { beeps: [34, 35, 36, 37, 38, 39], end: 40 }

  it('rend un bip quand la fenetre en contient un', () => {
    expect(cuesBetween(schedule, 33.5, 34.2)).toEqual(['beep'])
  })

  it('n en rend qu un seul meme si plusieurs sont franchis', () => {
    // Un onglet revenu d'arriere-plan ne doit pas rattraper trente bips.
    expect(cuesBetween(schedule, 33, 39.5)).toEqual(['beep'])
  })

  it('rend la fin quand elle est franchie', () => {
    expect(cuesBetween(schedule, 39.8, 40.1)).toEqual(['end'])
  })

  it('rend bip et fin quand les deux tombent dans l intervalle', () => {
    expect(cuesBetween(schedule, 38.5, 40.5)).toEqual(['beep', 'end'])
  })

  it('ne rend rien hors des reperes', () => {
    expect(cuesBetween(schedule, 10, 20)).toEqual([])
  })

  it('ne rend rien sur un intervalle qui ne progresse pas', () => {
    expect(cuesBetween(schedule, 34, 34)).toEqual([])
    expect(cuesBetween(schedule, 34, 33)).toEqual([])
  })

  it('ne rejoue pas un repere deja franchi', () => {
    // La borne basse est exclue : le tick suivant ne repete pas le meme bip.
    expect(cuesBetween(schedule, 34, 34.5)).toEqual([])
  })
})
