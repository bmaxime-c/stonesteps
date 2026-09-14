import { describe, expect, it } from 'vitest'

import type { LevelOutcome } from '@/lib/session/model'

import type { Grid, GridVersion, Level } from './model'
import {
  editableVersion,
  isFrozen,
  latestPublished,
  playableVersion,
  progressionVersions,
} from './model'
import { gridProgress } from './progress'

function level(id: string, position: number): Level {
  return {
    id,
    position,
    exercises: [
      {
        id: `e-${id}`,
        exerciseId: 'x1',
        exerciseName: 'Pompes',
        position: 1,
        sets: [
          {
            id: `s-${id}`,
            position: 1,
            targetReps: 10,
            timerMode: 'none',
            timerSeconds: null,
          },
        ],
      },
    ],
  }
}

function version(
  number: number,
  prefix: number,
  levelIds: string[],
  status: GridVersion['status'] = 'published',
): GridVersion {
  return {
    id: `v${number}`,
    version: number,
    status,
    name: 'Push Day',
    accentColor: '#00FF87',
    restSeconds: 60,
    unchangedPrefix: prefix,
    levels: levelIds.map((id, index) => level(id, index + 1)),
  }
}

function grid(over: Partial<Grid> = {}): Grid {
  return {
    id: 'g1',
    ownerId: 'u1',
    ownerName: 'Maxime',
    isPublic: false,
    deletedAt: null,
    owned: true,
    publishedVersions: [version(1, 0, ['a1', 'a2', 'a3'])],
    draft: null,
    follow: null,
    followerCount: 0,
    ...over,
  }
}

const done = (levelId: string): Pick<LevelOutcome, 'levelId' | 'validated'> => ({
  levelId,
  validated: true,
})

describe('version jouee', () => {
  it('est la derniere publiee', () => {
    const g = grid({
      publishedVersions: [version(1, 0, ['a1']), version(2, 1, ['b1'])],
    })
    expect(playableVersion(g)?.version).toBe(2)
    expect(latestPublished(g)?.version).toBe(2)
  })

  it('est celle du gel pour un suivi retire', () => {
    // Le createur a cesse de partager : le suiveur garde ce qu'il avait.
    const g = grid({
      owned: false,
      publishedVersions: [
        version(1, 0, ['a1']),
        version(2, 1, ['b1']),
        version(3, 1, ['c1']),
      ],
      follow: { frozenAtVersion: 2 },
    })
    expect(playableVersion(g)?.version).toBe(2)
    expect(latestPublished(g)?.version).toBe(3)
    expect(isFrozen(g)).toBe(true)
  })

  it('est nulle tant que rien n est publie', () => {
    const g = grid({ publishedVersions: [], draft: version(1, 0, ['a1'], 'draft') })
    expect(playableVersion(g)).toBeNull()
  })
})

describe('versions qui comptent pour la progression', () => {
  it('s arrete a celle qu on joue', () => {
    const g = grid({
      publishedVersions: [
        version(1, 0, ['a1']),
        version(2, 1, ['b1']),
        version(3, 1, ['c1']),
      ],
      follow: { frozenAtVersion: 2 },
      owned: false,
    })
    expect(progressionVersions(g).map((v) => v.version)).toEqual([1, 2])
  })

  it('les prend toutes quand rien n est gele', () => {
    const g = grid({
      publishedVersions: [version(1, 0, ['a1']), version(2, 1, ['b1'])],
    })
    expect(progressionVersions(g).map((v) => v.version)).toEqual([1, 2])
  })
})

describe('constructeur', () => {
  it('ouvre le brouillon quand il existe', () => {
    const g = grid({ draft: version(2, 0, ['b1'], 'draft') })
    expect(editableVersion(g)?.status).toBe('draft')
  })

  it('ouvre la derniere publiee sinon', () => {
    expect(editableVersion(grid())?.status).toBe('published')
  })
})

describe('progression sur une grille', () => {
  it('part du premier niveau sur une grille neuve', () => {
    const progress = gridProgress(grid(), [])
    expect(progress?.current?.position).toBe(1)
    expect(progress?.carry).toBe(0)
    expect(progress?.validatedCount).toBe(0)
  })

  it('avance avec les seances validees', () => {
    const progress = gridProgress(grid(), [done('a1'), done('a2')])
    expect(progress?.current?.position).toBe(3)
    expect(progress?.validatedCount).toBe(2)
  })

  it('reporte la progression d une version a l autre', () => {
    const g = grid({
      publishedVersions: [
        version(1, 0, ['a1', 'a2', 'a3']),
        version(2, 3, ['b1', 'b2', 'b3']),
      ],
    })
    const progress = gridProgress(g, [done('a1'), done('a2')])
    expect(progress?.version.version).toBe(2)
    expect(progress?.carry).toBe(2)
    expect(progress?.current?.position).toBe(3)
  })

  it('ne reporte rien a qui n a rien joue', () => {
    // Le nerf du partage : un suiveur qui arrive sur la v2 ne recupere pas la
    // progression du createur, meme si la version porte un prefixe intact.
    const g = grid({
      owned: false,
      publishedVersions: [
        version(1, 0, ['a1', 'a2', 'a3']),
        version(2, 3, ['b1', 'b2', 'b3']),
      ],
      follow: { frozenAtVersion: null },
    })
    const progress = gridProgress(g, [])
    expect(progress?.carry).toBe(0)
    expect(progress?.current?.position).toBe(1)
  })

  it('s arrete a la version gelee', () => {
    const g = grid({
      owned: false,
      publishedVersions: [
        version(1, 0, ['a1', 'a2']),
        version(2, 2, ['b1', 'b2']),
        version(3, 2, ['c1', 'c2']),
      ],
      follow: { frozenAtVersion: 2 },
    })
    const progress = gridProgress(g, [done('a1')])
    expect(progress?.version.version).toBe(2)
    expect(progress?.carry).toBe(1)
  })

  it('rend null sans version publiee', () => {
    expect(gridProgress(grid({ publishedVersions: [] }), [])).toBeNull()
  })

  it('marque la grille terminee', () => {
    const progress = gridProgress(grid(), [done('a1'), done('a2'), done('a3')])
    expect(progress?.current).toBeNull()
    expect(progress?.validatedCount).toBe(3)
  })
})
