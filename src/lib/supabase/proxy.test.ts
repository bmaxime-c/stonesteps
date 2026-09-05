import { beforeAll, describe, expect, it } from 'vitest'

beforeAll(() => {
  // Le module valide ses variables d'environnement au chargement.
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://exemple.supabase.co'
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_test'
})

describe('isPublic', () => {
  it('laisse passer les routes ouvertes', async () => {
    const { isPublic } = await import('./proxy')
    for (const path of ['/', '/login', '/signup', '/offline', '/auth/callback']) {
      expect(isPublic(path)).toBe(true)
    }
  })

  it('protege les routes applicatives', async () => {
    const { isPublic } = await import('./proxy')
    for (const path of ['/dashboard', '/dashboard/grilles', '/seance/123']) {
      expect(isPublic(path)).toBe(false)
    }
  })

  it('ne confond pas un prefixe avec un segment', async () => {
    const { isPublic } = await import('./proxy')
    // "/logins" n'est pas "/login" : la comparaison se fait segment par segment.
    expect(isPublic('/logins')).toBe(false)
  })
})
