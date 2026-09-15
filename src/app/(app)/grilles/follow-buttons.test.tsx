import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { DuplicateResult, GridActionResult } from './action-state'
import { AddGridButton, DuplicateGridButton, RemoveGridButton } from './follow-buttons'

const push = vi.fn()
const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh }) }))

const follow = vi.fn(async (_gridId: string): Promise<GridActionResult> => ({
  error: null,
}))
const unfollow = vi.fn(async (_gridId: string): Promise<GridActionResult> => ({
  error: null,
}))
const duplicate = vi.fn(async (_gridId: string): Promise<DuplicateResult> => ({
  gridId: 'copie-1',
  error: null,
}))

vi.mock('./actions', () => ({
  followGrid: (gridId: string) => follow(gridId),
  unfollowGrid: (gridId: string) => unfollow(gridId),
  duplicateGrid: (gridId: string) => duplicate(gridId),
}))

beforeEach(() => {
  push.mockClear()
  refresh.mockClear()
  follow.mockClear()
  unfollow.mockClear()
  duplicate.mockClear()
})

describe('adopter', () => {
  it('ajoute la grille et rafraichit la liste', async () => {
    const user = userEvent.setup()
    render(<AddGridButton gridId="g1" />)

    await user.click(screen.getByRole('button', { name: 'Ajouter' }))
    expect(follow).toHaveBeenCalledWith('g1')
    expect(refresh).toHaveBeenCalled()
  })

  it('affiche l erreur sans quitter l ecran', async () => {
    follow.mockResolvedValueOnce({ error: "Cette grille n'a pas pu être ajoutée." })

    const user = userEvent.setup()
    render(<AddGridButton gridId="g1" />)
    await user.click(screen.getByRole('button', { name: 'Ajouter' }))

    expect(
      await screen.findByText("Cette grille n'a pas pu être ajoutée."),
    ).toBeInTheDocument()
    expect(refresh).not.toHaveBeenCalled()
  })
})

describe('retirer', () => {
  it('retire la grille suivie', async () => {
    const user = userEvent.setup()
    render(<RemoveGridButton gridId="g1" />)

    await user.click(screen.getByRole('button', { name: 'Retirer' }))
    expect(unfollow).toHaveBeenCalledWith('g1')
    expect(refresh).toHaveBeenCalled()
  })
})

describe('dupliquer', () => {
  it('ouvre la copie, pas l originale', async () => {
    // La copie est desormais la sienne : rester devant l'originale n'aurait
    // pas de sens.
    const user = userEvent.setup()
    render(<DuplicateGridButton gridId="g1" />)

    await user.click(screen.getByRole('button', { name: 'Dupliquer' }))
    expect(duplicate).toHaveBeenCalledWith('g1')
    expect(push).toHaveBeenCalledWith('/grilles/copie-1')
  })

  it('affiche l erreur sans naviguer', async () => {
    duplicate.mockResolvedValueOnce({
      gridId: null,
      error: "La copie n'a pas pu être créée.",
    })

    const user = userEvent.setup()
    render(<DuplicateGridButton gridId="g1" />)
    await user.click(screen.getByRole('button', { name: 'Dupliquer' }))

    expect(await screen.findByText("La copie n'a pas pu être créée.")).toBeInTheDocument()
    expect(push).not.toHaveBeenCalled()
  })
})
