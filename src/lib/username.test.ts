import { describe, expect, it } from 'vitest'

import { USERNAME_PATTERN, normalizeUsername } from './username'

describe('normalizeUsername', () => {
  it('met en minuscules et remplace les espaces par des tirets', () => {
    expect(normalizeUsername('Max Blanc')).toBe('max-blanc')
  })

  it('supprime les caracteres non autorises', () => {
    expect(normalizeUsername('max@blanc!')).toBe('maxblanc')
  })

  it('conserve tirets et underscores', () => {
    expect(normalizeUsername('max_blanc-42')).toBe('max_blanc-42')
  })

  it('tronque a 30 caracteres', () => {
    expect(normalizeUsername('a'.repeat(50))).toHaveLength(30)
  })

  it('produit une valeur acceptee par la contrainte SQL', () => {
    expect(USERNAME_PATTERN.test(normalizeUsername('  Jean-Pierre D. '))).toBe(true)
  })

  it('rejette une saisie trop courte une fois nettoyee', () => {
    expect(USERNAME_PATTERN.test(normalizeUsername('a!'))).toBe(false)
  })
})
