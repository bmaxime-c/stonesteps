import { describe, expect, it } from 'vitest'

import { fitWithin, isAcceptedImageType, isValidImagePath, publicImageUrl } from './image'

describe('reduction d image', () => {
  it('reduit le plus grand cote en gardant les proportions', () => {
    expect(fitWithin(4000, 3000, 800)).toEqual({ width: 800, height: 600 })
    expect(fitWithin(1000, 2000, 800)).toEqual({ width: 400, height: 800 })
  })

  it('n agrandit jamais une petite image', () => {
    expect(fitWithin(320, 200, 800)).toEqual({ width: 320, height: 200 })
  })

  it('garde au moins un pixel sur une image tres allongee', () => {
    expect(fitWithin(100000, 10, 800)).toEqual({ width: 800, height: 1 })
  })
})

describe('types acceptes', () => {
  it('accepte png, jpeg et webp', () => {
    expect(isAcceptedImageType('image/png')).toBe(true)
    expect(isAcceptedImageType('image/jpeg')).toBe(true)
    expect(isAcceptedImageType('image/webp')).toBe(true)
  })

  it('refuse le reste', () => {
    expect(isAcceptedImageType('image/gif')).toBe(false)
    expect(isAcceptedImageType('application/pdf')).toBe(false)
  })
})

describe('chemin d image', () => {
  it('accepte un uuid en webp ou en jpeg', () => {
    expect(isValidImagePath('0b8f5a52-3c1e-4f7a-9d2b-6e4c1a2b3c4d.webp')).toBe(true)
    expect(isValidImagePath('0b8f5a52-3c1e-4f7a-9d2b-6e4c1a2b3c4d.jpg')).toBe(true)
  })

  it('refuse un chemin qui sort de la racine ou change d extension', () => {
    expect(isValidImagePath('../0b8f5a52-3c1e-4f7a-9d2b-6e4c1a2b3c4d.webp')).toBe(false)
    expect(isValidImagePath('dossier/0b8f5a52-3c1e-4f7a-9d2b-6e4c1a2b3c4d.webp')).toBe(
      false,
    )
    expect(isValidImagePath('0b8f5a52-3c1e-4f7a-9d2b-6e4c1a2b3c4d.svg')).toBe(false)
  })
})

describe('url publique', () => {
  it('pointe vers le bucket public du projet', () => {
    expect(publicImageUrl('https://abc.supabase.co/', 'x.webp')).toBe(
      'https://abc.supabase.co/storage/v1/object/public/exercise-images/x.webp',
    )
  })

  it('rend null sans image', () => {
    expect(publicImageUrl('https://abc.supabase.co', null)).toBeNull()
  })
})
