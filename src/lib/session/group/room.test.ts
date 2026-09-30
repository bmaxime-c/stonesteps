import { describe, expect, it } from 'vitest'

import {
  ROOM_CAPACITY,
  joinRefusal,
  memberCeiling,
  roomCeiling,
  selectableLevels,
  type JoinContext,
} from './room'

const levels = [
  { id: 'l1', position: 1 },
  { id: 'l2', position: 2 },
  { id: 'l3', position: 3 },
  { id: 'l4', position: 4 },
]

const members = (...ceilings: number[]) =>
  ceilings.map((levelCeiling, index) => ({ userId: `u${index}`, levelCeiling }))

function context(overrides: Partial<JoinContext> = {}): JoinContext {
  return {
    userId: 'me',
    room: { status: 'open', gridVersionId: 'v2', members: members(2, 3) },
    follows: true,
    playableVersionId: 'v2',
    ...overrides,
  }
}

describe('plafond d un membre', () => {
  it('vaut la position de son niveau en cours', () => {
    expect(
      memberCeiling({ current: { id: 'l3', position: 3 }, version: { levels } }),
    ).toBe(3)
  })

  it('vaut le nombre de niveaux quand la grille est terminee', () => {
    // Tout est rejouable : aucun niveau ne lui est ferme.
    expect(memberCeiling({ current: null, version: { levels } })).toBe(4)
  })
})

describe('plafond du salon', () => {
  it('suit le membre le moins avance', () => {
    expect(roomCeiling(members(3, 1, 2))).toBe(1)
  })

  it('vaut 0 pour un salon vide', () => {
    expect(roomCeiling([])).toBe(0)
  })

  it('compte un membre a grille terminee pour le nombre de niveaux', () => {
    const finished = memberCeiling({ current: null, version: { levels } })
    expect(roomCeiling(members(finished, 3))).toBe(3)
    expect(roomCeiling(members(finished))).toBe(4)
  })
})

describe('niveaux selectionnables', () => {
  it('ne renvoie que les positions au plus egales au plafond', () => {
    expect(selectableLevels(levels, 2).map((level) => level.id)).toEqual(['l1', 'l2'])
  })

  it('ne renvoie rien sous un plafond nul', () => {
    expect(selectableLevels(levels, 0)).toEqual([])
  })

  it('rend les niveaux dans l ordre des positions', () => {
    const shuffled = [levels[2], levels[0], levels[1]]
    expect(selectableLevels(shuffled, 3).map((level) => level.position)).toEqual([
      1, 2, 3,
    ])
  })
})

describe('refus d entree dans un salon', () => {
  it('laisse entrer dans un salon ouvert sur la meme version', () => {
    expect(joinRefusal(context())).toBeNull()
  })

  it('refuse une version jouable differente', () => {
    expect(joinRefusal(context({ playableVersionId: 'v1' }))).toBe('version')
  })

  it('refuse sans version jouable', () => {
    expect(joinRefusal(context({ playableVersionId: null }))).toBe('version')
  })

  it('refuse un non membre dans un salon lance', () => {
    const room = { status: 'running' as const, gridVersionId: 'v2', members: members(2) }
    expect(joinRefusal(context({ room }))).toBe('started')
  })

  it('refuse un non membre dans un salon termine', () => {
    const room = { status: 'finished' as const, gridVersionId: 'v2', members: members(2) }
    expect(joinRefusal(context({ room }))).toBe('started')
  })

  it('refuse un septieme participant', () => {
    const room = {
      status: 'open' as const,
      gridVersionId: 'v2',
      members: members(...Array.from({ length: ROOM_CAPACITY }, () => 1)),
    }
    expect(joinRefusal(context({ room }))).toBe('full')
  })

  it('demande d adopter une grille qu on ne suit pas', () => {
    expect(joinRefusal(context({ follows: false }))).toBe('not_following')
  })

  it('laisse revenir un membre deja inscrit dans un salon lance', () => {
    const room = {
      status: 'running' as const,
      gridVersionId: 'v2',
      members: [{ userId: 'me', levelCeiling: 2 }],
    }
    expect(joinRefusal(context({ room }))).toBeNull()
  })

  it('laisse revenir un membre meme si sa version a bouge depuis', () => {
    // Il est entre sur la version figee du salon : c'est elle qu'il joue ici.
    const room = {
      status: 'running' as const,
      gridVersionId: 'v2',
      members: [{ userId: 'me', levelCeiling: 2 }],
    }
    expect(joinRefusal(context({ room, playableVersionId: 'v3' }))).toBeNull()
  })

  it('signale un salon lance avant une version differente', () => {
    // Adopter ou changer de version n'y changerait rien : autant le dire.
    const room = { status: 'running' as const, gridVersionId: 'v2', members: members(2) }
    expect(joinRefusal(context({ room, playableVersionId: 'v1', follows: false }))).toBe(
      'started',
    )
  })
})
