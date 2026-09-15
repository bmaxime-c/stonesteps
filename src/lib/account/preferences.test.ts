import { describe, expect, it } from 'vitest'

import {
  DEFAULT_TIMER_CUES,
  describeWarningWindow,
  hasAnyCue,
  isValidWarningPercent,
  stepWarningPercent,
} from './preferences'

describe('valeurs par defaut', () => {
  it('allume le son et le clignotement', () => {
    expect(DEFAULT_TIMER_CUES.sound).toBe(true)
    expect(DEFAULT_TIMER_CUES.blink).toBe(true)
  })

  it('laisse le flash eteint', () => {
    // Il demande l'acces a la camera : on ne reclame pas une permission sans
    // que l'utilisateur l'ait voulue.
    expect(DEFAULT_TIMER_CUES.flash).toBe(false)
  })

  it('annonce la fin a quinze pour cent', () => {
    expect(DEFAULT_TIMER_CUES.warningPercent).toBe(15)
  })
})

describe('reglage de la fenetre', () => {
  it('avance par pas de cinq', () => {
    expect(stepWarningPercent(15, 1)).toBe(20)
    expect(stepWarningPercent(15, -1)).toBe(10)
  })

  it('reste dans ses bornes', () => {
    expect(stepWarningPercent(5, -1)).toBe(5)
    expect(stepWarningPercent(50, 1)).toBe(50)
  })

  it('refuse une valeur hors bornes ou non entiere', () => {
    expect(isValidWarningPercent(15)).toBe(true)
    expect(isValidWarningPercent(4)).toBe(false)
    expect(isValidWarningPercent(51)).toBe(false)
    expect(isValidWarningPercent(12.5)).toBe(false)
  })
})

describe('illustration du reglage', () => {
  it('traduit le pourcentage en secondes sur une serie type', () => {
    // « 15 % » ne parle pas tout seul.
    expect(describeWarningWindow(15)).toBe('15 % — environ 6 s sur une série de 40 s')
    expect(describeWarningWindow(50)).toBe('50 % — environ 20 s sur une série de 40 s')
  })
})

describe('reperes actifs', () => {
  it('en voit au moins un des qu un canal est ouvert', () => {
    expect(hasAnyCue(DEFAULT_TIMER_CUES)).toBe(true)
    expect(hasAnyCue({ ...DEFAULT_TIMER_CUES, sound: false, blink: false })).toBe(false)
    expect(
      hasAnyCue({ ...DEFAULT_TIMER_CUES, sound: false, blink: false, flash: true }),
    ).toBe(true)
  })
})
