import { describe, expect, it } from 'vitest'

import {
  hasPasswordIdentity,
  validateDisplayName,
  validatePasswordChange,
} from './validation'

describe('nom affiche', () => {
  it('accepte un nom vide : l adresse en tient lieu', () => {
    expect(validateDisplayName('')).toBeNull()
    expect(validateDisplayName('   ')).toBeNull()
  })

  it('accepte un nom ordinaire', () => {
    expect(validateDisplayName('Maxime')).toBeNull()
  })

  it('refuse au-dela de quarante caracteres', () => {
    expect(validateDisplayName('x'.repeat(41))).toMatch(/40 caractères/)
  })

  it('ne compte pas les blancs de bordure', () => {
    expect(validateDisplayName(`  ${'x'.repeat(40)}  `)).toBeNull()
  })
})

describe('changement de mot de passe', () => {
  const change = {
    current: 'ancien-mot-de-passe',
    next: 'nouveau-mot-de-passe',
    confirmation: 'nouveau-mot-de-passe',
  }

  it('accepte un changement complet et coherent', () => {
    expect(validatePasswordChange(change)).toBeNull()
  })

  it('exige le mot de passe actuel', () => {
    // Sans lui, une session laissee ouverte suffirait a prendre le compte.
    expect(validatePasswordChange({ ...change, current: '' })).toMatch(/actuel/)
  })

  it('impose une longueur minimale', () => {
    expect(
      validatePasswordChange({ ...change, next: 'court12', confirmation: 'court12' }),
    ).toMatch(/8 caractères/)
  })

  it('exige une confirmation identique', () => {
    expect(validatePasswordChange({ ...change, confirmation: 'autre-chose' })).toMatch(
      /confirmation/,
    )
  })

  it('refuse de reconduire le mot de passe actuel', () => {
    expect(
      validatePasswordChange({
        current: 'meme-mot-de-passe',
        next: 'meme-mot-de-passe',
        confirmation: 'meme-mot-de-passe',
      }),
    ).toMatch(/identique/)
  })

  it('signale le probleme le plus en amont d abord', () => {
    // Tout est faux : c'est l'absence de mot de passe actuel qu'on annonce.
    expect(validatePasswordChange({ current: '', next: 'a', confirmation: 'b' })).toMatch(
      /actuel/,
    )
  })
})

describe('identite du compte', () => {
  it('autorise le changement sur un compte e-mail', () => {
    expect(hasPasswordIdentity(['email'])).toBe(true)
    expect(hasPasswordIdentity(['email', 'google'])).toBe(true)
  })

  it('le refuse sur un compte Google seul', () => {
    // Il n'a pas de mot de passe chez nous : le reglage serait sans effet.
    expect(hasPasswordIdentity(['google'])).toBe(false)
    expect(hasPasswordIdentity([])).toBe(false)
  })
})
