import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import type { SessionRecord, SetResult, SetStatus, SetUnit } from '@/lib/session/model'

import { StatsBoard } from './stats-board'

const TODAY = new Date(2026, 8, 14, 12)

function daysAgo(count: number): string {
  const date = new Date(TODAY)
  date.setDate(date.getDate() - count)
  return date.toISOString()
}

let index = 0
function result(
  exerciseName: string,
  actualValue: number,
  targetValue: number,
  status: SetStatus,
  unit: SetUnit = 'reps',
): SetResult {
  index += 1
  return {
    levelSetId: `ls${index}`,
    setIndex: index,
    exerciseName,
    setLabel: 'Série 1/1',
    unit,
    targetValue,
    actualValue,
    status,
  }
}

const sessions: SessionRecord[] = [
  {
    id: 'a',
    gridId: 'g1',
    gridName: 'Push Day',
    levelNumber: 1,
    startedAt: daysAgo(20),
    validated: true,
    results: [result('Pompes', 10, 10, 'success')],
  },
  {
    id: 'b',
    gridId: 'g1',
    gridName: 'Push Day',
    levelNumber: 2,
    startedAt: daysAgo(10),
    validated: false,
    results: [result('Pompes', 9, 12, 'fail')],
  },
  {
    id: 'c',
    gridId: 'g1',
    gridName: 'Push Day',
    levelNumber: 2,
    startedAt: daysAgo(3),
    validated: true,
    results: [result('Pompes', 14, 12, 'surpass')],
  },
  {
    id: 'd',
    gridId: 'g2',
    gridName: 'Pull & Core',
    levelNumber: 1,
    startedAt: daysAgo(1),
    validated: true,
    results: [result('Tractions', 6, 6, 'success')],
  },
]

function setup() {
  return {
    user: userEvent.setup(),
    ...render(<StatsBoard sessions={sessions} today={TODAY.toISOString()} />),
  }
}

/** Retrouve une carte par son titre, pour ne pas confondre deux compteurs. */
function card(title: string | RegExp) {
  return screen.getByRole('heading', { name: title }).closest('section') as HTMLElement
}

describe('indicateurs de tete', () => {
  it('compte seances, niveaux valides, reps et taux de reussite', () => {
    setup()
    const kpis = [
      ['Séances', '4'],
      ['Niveaux validés', '3'],
      ['Reps cumulées', '39'],
      ['Taux de réussite', '75%'],
    ]
    for (const [label, value] of kpis) {
      const tile = screen.getByText(label).closest('div') as HTMLElement
      expect(within(tile).getByText(value)).toBeInTheDocument()
    }
  })
})

describe('bascule de progression', () => {
  it('ouvre par exercice et liste les exercices', () => {
    setup()
    expect(screen.getByRole('button', { name: 'Par exercice' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: 'Pompes' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tractions' })).toBeInTheDocument()
  })

  it('passe par grille et change les puces comme le graphique', async () => {
    const { user } = setup()
    await user.click(screen.getByRole('button', { name: 'Par grille' }))

    expect(screen.getByRole('button', { name: 'Push Day' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Pompes' })).not.toBeInTheDocument()
    expect(
      screen.getByRole('img', { name: /Niveau atteint sur Push Day, 3 séances/ }),
    ).toBeInTheDocument()
  })

  it('suit l exercice choisi', async () => {
    const { user } = setup()
    expect(
      screen.getByRole('img', { name: /Progression de Pompes sur 3 séances/ }),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Tractions' }))
    expect(
      screen.getByRole('img', { name: /Progression de Tractions sur 1 séances/ }),
    ).toBeInTheDocument()
  })
})

describe('niveaux', () => {
  it('montre tentatives et date de validation pour la grille suivie', () => {
    setup()
    const block = card(/Niveaux — Push Day/)
    expect(within(block).getByText('Niveau 1')).toBeInTheDocument()
    expect(within(block).getByText(/1 tentative ·/)).toBeInTheDocument()
    expect(within(block).getByText(/2 tentatives ·/)).toBeInTheDocument()
  })

  it('suit la grille choisie dans la bascule', async () => {
    const { user } = setup()
    await user.click(screen.getByRole('button', { name: 'Par grille' }))
    await user.click(screen.getByRole('button', { name: 'Pull & Core' }))

    expect(
      screen.getByRole('heading', { name: /Niveaux — Pull & Core/ }),
    ).toBeInTheDocument()
  })
})

describe('repartition', () => {
  it('compte les trois statuts', () => {
    setup()
    const block = card('Réussite / dépassement / échec')
    expect(within(block).getByText('Réussies')).toBeInTheDocument()
    expect(within(block).getByText('Dépassées')).toBeInTheDocument()
    expect(within(block).getByText('Échouées')).toBeInTheDocument()
    // Deux reussies, une depassee, une echouee.
    expect(within(block).getAllByText('1')).toHaveLength(2)
    expect(within(block).getByText('2')).toBeInTheDocument()
  })
})

describe('regularite', () => {
  it('rend trente-cinq jours et marque ceux qui portent une seance', () => {
    setup()
    const block = card(/Régularité/)
    const cells = block.querySelectorAll('[title]')
    expect(cells).toHaveLength(35)

    const active = [...cells].filter((cell) => cell.className.includes('bg-success'))
    // Quatre seances, dont aucune le meme jour.
    expect(active).toHaveLength(4)
  })
})

describe('historique vide pour une selection', () => {
  it('le dit plutot que de tracer une courbe sans point', () => {
    render(
      <StatsBoard
        sessions={[{ ...sessions[0], results: [] }]}
        today={TODAY.toISOString()}
      />,
    )
    expect(screen.getByText('Aucune donnée pour cet exercice.')).toBeInTheDocument()
  })
})
