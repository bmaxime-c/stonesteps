import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import type { LevelSet } from '@/lib/grids/model'

import { GridDetail, type DetailLevel } from './grid-detail'

const grid = {
  id: 'g1',
  name: 'Push Day',
  accentColor: '#00FF87',
  restSeconds: 60,
}

function set(over: Partial<LevelSet> = {}): LevelSet {
  return {
    id: 's1',
    position: 1,
    targetReps: 10,
    timerMode: 'none',
    timerSeconds: null,
    ...over,
  }
}

const levels: DetailLevel[] = [
  {
    id: 'l1',
    position: 1,
    state: 'validated',
    validatedAt: new Date(2026, 7, 11, 10).toISOString(),
    exercises: [
      { id: 'e1', name: 'Pompes', sets: [set(), set({ id: 's2', position: 2 })] },
    ],
  },
  {
    id: 'l2',
    position: 2,
    state: 'current',
    validatedAt: null,
    exercises: [
      {
        id: 'e2',
        name: 'Planche (gainage)',
        sets: [set({ id: 's3', timerMode: 'minimal', timerSeconds: 30 })],
      },
    ],
  },
  {
    id: 'l3',
    position: 3,
    state: 'locked',
    validatedAt: null,
    exercises: [{ id: 'e3', name: 'Dips', sets: [set({ id: 's4' })] }],
  },
]

function setup() {
  return {
    user: userEvent.setup(),
    ...render(<GridDetail grid={grid} currentLevelId="l2" levels={levels} />),
  }
}

describe('en-tete', () => {
  it('situe la progression et rappelle le repos', () => {
    setup()
    expect(screen.getByText(/Niveau 2 sur 3/)).toBeInTheDocument()
    expect(screen.getByText(/repos 60s/)).toBeInTheDocument()
  })
})

describe('frise des niveaux', () => {
  it('ouvre sur le niveau en cours', () => {
    setup()
    expect(screen.getByText('Niveau 2')).toBeInTheDocument()
    expect(screen.getByText('Planche (gainage)')).toBeInTheDocument()
    expect(screen.getByText('1 série · tenir 30s min')).toBeInTheDocument()
  })

  it('annonce l etat de chaque pastille', () => {
    setup()
    expect(screen.getByRole('button', { name: 'Niveau 1, validé' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Niveau 2, en cours' })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Niveau 3, verrouillé' }),
    ).toBeInTheDocument()
  })

  it('montre le contenu du niveau tape', async () => {
    const { user } = setup()
    await user.click(screen.getByRole('button', { name: 'Niveau 1, validé' }))

    expect(screen.getByText('Pompes')).toBeInTheDocument()
    expect(screen.getByText('2 séries · 10/10 reps')).toBeInTheDocument()
  })
})

describe('ce qu on peut lancer', () => {
  it('ne propose de commencer que le niveau en cours', () => {
    setup()
    const cta = screen.getByRole('link', { name: 'Commencer le niveau 2' })
    expect(cta).toHaveAttribute('href', '/seance/g1')
  })

  it('affiche la date de validation sur un niveau deja passe', async () => {
    const { user } = setup()
    await user.click(screen.getByRole('button', { name: 'Niveau 1, validé' }))

    expect(screen.getByText('Niveau validé le 11 août')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Commencer/ })).not.toBeInTheDocument()
  })

  it('explique pourquoi un niveau plus loin n est pas jouable', async () => {
    const { user } = setup()
    await user.click(screen.getByRole('button', { name: 'Niveau 3, verrouillé' }))

    expect(
      screen.getByText("Niveau verrouillé — validez d'abord le niveau 2"),
    ).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Commencer/ })).not.toBeInTheDocument()
  })
})
