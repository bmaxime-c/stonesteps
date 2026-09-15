import { describe, expect, it } from 'vitest'

import type { LevelOutcome, SetStatus } from './model'
import {
  carryForVersions,
  countByStatus,
  currentLevel,
  failedSetCount,
  isLevelValidated,
  levelStates,
  reachedLevel,
  validatedAt,
} from './level'

const results = (...statuses: SetStatus[]) => statuses.map((status) => ({ status }))

const levels = [
  { id: 'l1', position: 1 },
  { id: 'l2', position: 2 },
  { id: 'l3', position: 3 },
]

function outcome(
  levelId: string,
  validated: boolean,
  startedAt = '2026-09-01T10:00:00Z',
): Pick<LevelOutcome, 'levelId' | 'validated' | 'startedAt'> {
  return { levelId, validated, startedAt }
}

describe('validation d un niveau — tout ou rien', () => {
  it('valide quand toutes les series sont reussies', () => {
    expect(isLevelValidated(results('success', 'success', 'success'))).toBe(true)
  })

  it('valide quand des series sont depassees', () => {
    expect(isLevelValidated(results('success', 'surpass', 'success'))).toBe(true)
  })

  it('invalide des qu une seule serie echoue', () => {
    // Le cas central : tout reussi sauf une serie.
    expect(
      isLevelValidated(results('success', 'surpass', 'success', 'fail', 'success')),
    ).toBe(false)
  })

  it('n invalide pas un niveau vide par accident', () => {
    // Une grille sans serie est refusee par la validation de grille : ici on
    // se contente de ne pas declarer un niveau valide sans rien avoir joue.
    expect(isLevelValidated([])).toBe(false)
  })
})

describe('comptes du resume', () => {
  it('compte les series manquees', () => {
    expect(failedSetCount(results('success', 'fail', 'fail'))).toBe(2)
  })

  it('compte les trois statuts', () => {
    expect(countByStatus(results('success', 'surpass', 'fail', 'success'))).toEqual({
      success: 2,
      surpass: 1,
      fail: 1,
    })
  })
})

describe('niveau en cours', () => {
  it('est le premier niveau sans seance validee', () => {
    expect(currentLevel(levels, [])).toEqual({ id: 'l1', position: 1 })
  })

  it('avance quand un niveau est valide', () => {
    expect(currentLevel(levels, [outcome('l1', true)])).toEqual({ id: 'l2', position: 2 })
  })

  it('ne bouge pas apres une seance non validee', () => {
    const history = [outcome('l1', true), outcome('l2', false), outcome('l2', false)]
    expect(currentLevel(levels, history)).toEqual({ id: 'l2', position: 2 })
  })

  it('repart du meme niveau, meme rejoue plusieurs fois', () => {
    const history = [
      outcome('l1', true, '2026-08-01T10:00:00Z'),
      outcome('l2', false, '2026-08-08T10:00:00Z'),
      outcome('l2', false, '2026-08-15T10:00:00Z'),
      outcome('l2', true, '2026-08-22T10:00:00Z'),
    ]
    expect(currentLevel(levels, history)).toEqual({ id: 'l3', position: 3 })
  })

  it('renvoie null quand toute la grille est validee', () => {
    const history = [outcome('l1', true), outcome('l2', true), outcome('l3', true)]
    expect(currentLevel(levels, history)).toBeNull()
  })

  it('lit les positions, pas l ordre du tableau', () => {
    const desordre = [levels[2], levels[0], levels[1]]
    expect(currentLevel(desordre, [outcome('l1', true)])).toEqual({
      id: 'l2',
      position: 2,
    })
  })
})

describe('etats des niveaux', () => {
  it('verrouille tout ce qui suit le niveau en cours', () => {
    const states = levelStates(levels, [outcome('l1', true)])
    expect(states.get('l1')).toBe('validated')
    expect(states.get('l2')).toBe('current')
    expect(states.get('l3')).toBe('locked')
  })

  it('ne saute pas un niveau, meme si un niveau plus loin a ete valide', () => {
    // On ne monte pas deux crans d un coup : c est la position dans la suite
    // qui fait foi, pas l historique isole.
    const states = levelStates(levels, [outcome('l3', true)])
    expect(states.get('l1')).toBe('current')
    expect(states.get('l2')).toBe('locked')
    expect(states.get('l3')).toBe('locked')
  })

  it('marque tout comme valide quand la grille est terminee', () => {
    const history = [outcome('l1', true), outcome('l2', true), outcome('l3', true)]
    const states = levelStates(levels, history)
    expect([...states.values()]).toEqual(['validated', 'validated', 'validated'])
  })
})

describe('date de validation', () => {
  it('retient la premiere validation, pas la derniere', () => {
    const history = [
      outcome('l1', false, '2026-08-01T10:00:00Z'),
      outcome('l1', true, '2026-08-08T10:00:00Z'),
      outcome('l1', true, '2026-08-15T10:00:00Z'),
    ]
    expect(validatedAt('l1', history)).toBe('2026-08-08T10:00:00Z')
  })

  it('renvoie null tant que le niveau n est pas valide', () => {
    expect(validatedAt('l1', [outcome('l1', false)])).toBeNull()
  })
})

describe('niveaux reportes d une publication', () => {
  it('compte les niveaux reportes comme franchis', () => {
    // Les identifiants de niveau de l'ancienne version ont disparu : c'est le
    // report qui porte ce qui avait ete gagne.
    expect(currentLevel(levels, [], 2)).toEqual({ id: 'l3', position: 3 })
  })

  it('n en reporte aucun par defaut', () => {
    expect(currentLevel(levels, [])).toEqual({ id: 'l1', position: 1 })
  })

  it('avance encore avec les seances jouees sur la nouvelle version', () => {
    expect(currentLevel(levels, [outcome('l3', true)], 2)).toBeNull()
  })

  it('termine la grille quand tout est reporte', () => {
    expect(currentLevel(levels, [], 3)).toBeNull()
  })

  it('marque les niveaux reportes comme valides dans la frise', () => {
    const states = levelStates(levels, [], 2)
    expect(states.get('l1')).toBe('validated')
    expect(states.get('l2')).toBe('validated')
    expect(states.get('l3')).toBe('current')
  })
})

describe('position atteinte', () => {
  it('vaut la position du niveau en cours', () => {
    expect(reachedLevel(levels, [outcome('l1', true)])).toBe(2)
  })

  it('depasse la grille d un cran quand elle est terminee', () => {
    // C'est ce qu'attend le calcul du report : les niveaux franchis sont ceux
    // d'avant la position atteinte.
    const history = [outcome('l1', true), outcome('l2', true), outcome('l3', true)]
    expect(reachedLevel(levels, history)).toBe(4)
  })

  it('tient compte du report', () => {
    expect(reachedLevel(levels, [], 2)).toBe(3)
  })

  it('vaut un sur une grille neuve', () => {
    expect(reachedLevel(levels, [])).toBe(1)
  })
})

describe('report reconstruit version par version', () => {
  const v = (prefix: number, ids: string[]) => ({
    unchangedPrefix: prefix,
    levels: ids.map((id, index) => ({ id, position: index + 1 })),
  })

  it('ne reporte rien sur une premiere version', () => {
    expect(carryForVersions([v(0, ['a1', 'a2', 'a3'])], [])).toBe(0)
  })

  it('reporte ce qui etait franchi quand rien n a change', () => {
    // Deux niveaux valides sur la v1, prefixe intact : la v2 les reprend.
    const history = [outcome('a1', true), outcome('a2', true)]
    expect(
      carryForVersions([v(0, ['a1', 'a2', 'a3']), v(3, ['b1', 'b2', 'b3'])], history),
    ).toBe(2)
  })

  it('borne le report par le prefixe inchange', () => {
    const history = [outcome('a1', true), outcome('a2', true)]
    // Le niveau 2 a change : seul le premier survit.
    expect(
      carryForVersions([v(0, ['a1', 'a2', 'a3']), v(1, ['b1', 'b2', 'b3'])], history),
    ).toBe(1)
  })

  it('ne reporte rien a qui n a rien joue', () => {
    // C'est tout l'interet du calcul par utilisateur : un suiveur qui arrive
    // sur la v2 n'herite pas de la progression du createur.
    expect(carryForVersions([v(0, ['a1', 'a2']), v(2, ['b1', 'b2'])], [])).toBe(0)
  })

  it('cumule sur trois versions', () => {
    const history = [outcome('a1', true), outcome('a2', true), outcome('b3', true)]
    const versions = [
      v(0, ['a1', 'a2', 'a3']),
      v(3, ['b1', 'b2', 'b3']),
      v(3, ['c1', 'c2', 'c3']),
    ]
    // v1 : deux niveaux franchis. v2 : report 2, puis b3 valide, position 4.
    // v3 : report min(3, 3) = 3.
    expect(carryForVersions(versions, history)).toBe(3)
  })

  it('redescend quand une version reecrit le debut', () => {
    const history = [outcome('a1', true), outcome('a2', true), outcome('a3', true)]
    const versions = [v(0, ['a1', 'a2', 'a3']), v(0, ['b1', 'b2', 'b3'])]
    expect(carryForVersions(versions, history)).toBe(0)
  })

  it('rend zero sans aucune version', () => {
    expect(carryForVersions([], [])).toBe(0)
  })
})
