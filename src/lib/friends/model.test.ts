import { describe, expect, it } from 'vitest'

import { otherPartyId, resolveRelation, type FriendshipRow } from './model'

const ME = 'me'
const OTHER = 'other'

function row(overrides: Partial<FriendshipRow> = {}): FriendshipRow {
  return { requesterId: ME, addresseeId: OTHER, status: 'pending', ...overrides }
}

describe('resolveRelation', () => {
  it('reconnait son propre profil', () => {
    expect(resolveRelation(ME, ME, [])).toBe('self')
  })

  it('renvoie none sans ligne', () => {
    expect(resolveRelation(ME, OTHER, [])).toBe('none')
  })

  it('distingue une demande envoyee d une demande recue', () => {
    expect(resolveRelation(ME, OTHER, [row()])).toBe('outgoing-request')
    expect(
      resolveRelation(ME, OTHER, [row({ requesterId: OTHER, addresseeId: ME })]),
    ).toBe('incoming-request')
  })

  it('reconnait une amitie acceptee dans les deux sens', () => {
    expect(resolveRelation(ME, OTHER, [row({ status: 'accepted' })])).toBe('friends')
    expect(
      resolveRelation(ME, OTHER, [
        row({ requesterId: OTHER, addresseeId: ME, status: 'accepted' }),
      ]),
    ).toBe('friends')
  })

  it('signale un blocage quel que soit le sens', () => {
    expect(resolveRelation(ME, OTHER, [row({ status: 'blocked' })])).toBe('blocked')
    expect(
      resolveRelation(ME, OTHER, [
        row({ requesterId: OTHER, addresseeId: ME, status: 'blocked' }),
      ]),
    ).toBe('blocked')
  })

  it('ignore les lignes concernant des tiers', () => {
    const unrelated = row({ requesterId: 'a', addresseeId: 'b', status: 'accepted' })
    expect(resolveRelation(ME, OTHER, [unrelated])).toBe('none')
  })
})

describe('otherPartyId', () => {
  it('renvoie l autre partie quel que soit le sens', () => {
    expect(otherPartyId(ME, row())).toBe(OTHER)
    expect(otherPartyId(ME, row({ requesterId: OTHER, addresseeId: ME }))).toBe(OTHER)
  })
})
