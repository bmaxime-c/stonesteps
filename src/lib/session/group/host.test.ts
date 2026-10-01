import { describe, expect, it } from 'vitest'

import { HEARTBEAT_INTERVAL_MS, HOST_STALE_MS, hostCandidate, hostStale } from './host'

const member = (userId: string, joinedAt: string) => ({ userId, joinedAt })

const a = member('a', '2026-10-01T10:00:00.000Z')
const b = member('b', '2026-10-01T10:00:02.000Z')
const c = member('c', '2026-10-01T10:00:01.000Z')

describe('candidat a la prise de main', () => {
  it('choisit le present entre le plus tot', () => {
    // B entre a t2, C a t1 : C passe devant, l'ordre de la liste n'y fait rien.
    expect(hostCandidate([a, b, c], ['b', 'c'], 'a')).toBe('c')
  })

  it('ne designe personne tant que l hote est present', () => {
    expect(hostCandidate([a, b, c], ['a', 'b', 'c'], 'a')).toBeNull()
  })

  it('ignore les absents, meme plus anciens', () => {
    expect(hostCandidate([a, b, c], ['b'], 'a')).toBe('b')
  })

  it('ne designe jamais l hote lui-meme', () => {
    // Present selon le canal mais pas dans la liste lue : l'hote reste exclu.
    expect(hostCandidate([b, c], ['b', 'c'], 'c')).toBeNull()
    expect(hostCandidate([a, b], ['b'], 'a')).toBe('b')
  })

  it('ne designe personne si aucun membre n est present', () => {
    expect(hostCandidate([a, b, c], [], 'a')).toBeNull()
  })

  it('departage une entree simultanee par identifiant, comme la base', () => {
    const d = member('d', b.joinedAt)
    expect(hostCandidate([a, d, b], ['d', 'b'], 'a')).toBe('b')
  })

  it('ignore un present qui n est pas membre', () => {
    expect(hostCandidate([a, b], ['z', 'b'], 'a')).toBe('b')
  })
})

describe('hote silencieux', () => {
  const now = Date.parse('2026-10-01T10:01:00.000Z')
  const ago = (ms: number) => new Date(now - ms).toISOString()

  it('est perime apres 16 s sans battement', () => {
    expect(hostStale(ago(16_000), now)).toBe(true)
  })

  it('est vivant apres 4 s', () => {
    expect(hostStale(ago(4_000), now)).toBe(false)
  })

  it('est encore vivant pile au seuil, comme dans claim_room_host', () => {
    expect(hostStale(ago(HOST_STALE_MS), now)).toBe(false)
  })
})

describe('rythme du battement', () => {
  it('bat toutes les 5 s, trois fois avant le seuil de perte', () => {
    expect(HEARTBEAT_INTERVAL_MS).toBe(5_000)
    expect(HOST_STALE_MS).toBe(15_000)
  })
})
