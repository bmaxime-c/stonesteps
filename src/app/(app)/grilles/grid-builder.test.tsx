import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { emptyGrid } from '@/lib/grids/draft'
import type { CatalogExercise } from '@/lib/grids/queries'

import type { DeleteGridResult, SaveGridInput, SaveGridResult } from './action-state'
import { GridBuilder } from './grid-builder'

const push = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))

const save = vi.fn(async (input: SaveGridInput): Promise<SaveGridResult> => ({
  gridId: input.gridId ?? 'g1',
  error: null,
  issues: [],
}))
const remove = vi.fn(async (): Promise<DeleteGridResult> => ({ error: null }))

vi.mock('./actions', () => ({
  saveGrid: (input: SaveGridInput) => save(input),
  deleteGrid: () => remove(),
}))

const catalog: CatalogExercise[] = [
  { id: 'x1', name: 'Pompes', muscleGroup: 'push' },
  { id: 'x2', name: 'Tractions', muscleGroup: 'pull' },
  { id: 'x3', name: 'Planche (gainage)', muscleGroup: 'core' },
]

beforeEach(() => {
  push.mockClear()
  save.mockClear()
  remove.mockClear()
})

function setup(gridId: string | null = null) {
  return {
    user: userEvent.setup(),
    ...render(<GridBuilder gridId={gridId} initial={emptyGrid()} catalog={catalog} />),
  }
}

/** Ajoute un exercice du catalogue au niveau en cours d'edition. */
async function addFromLibrary(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(screen.getByRole('button', { name: '+ Ajouter un exercice' }))
  // Le nom accessible du bouton agrege les initiales et le « + » : on cherche
  // par inclusion, sans traiter les parentheses comme un groupe d'expression.
  await user.click(
    screen.getByRole('button', {
      name: (accessibleName) => accessibleName.includes(name),
    }),
  )
}

describe('bibliotheque', () => {
  it('groupe le catalogue et annonce le niveau vise', async () => {
    const { user } = setup()
    await user.click(screen.getByRole('button', { name: '+ Ajouter un exercice' }))

    expect(screen.getByText('Poussee')).toBeInTheDocument()
    expect(screen.getByText('Tirage')).toBeInTheDocument()
    expect(screen.getByText("L'exercice choisi rejoint le niveau 1.")).toBeInTheDocument()
  })

  it('ajoute l exercice avec une serie par defaut et revient au constructeur', async () => {
    const { user } = setup()
    await addFromLibrary(user, 'Pompes')

    expect(screen.queryByText('Poussee')).not.toBeInTheDocument()
    expect(screen.getByText('Pompes')).toBeInTheDocument()
    expect(screen.getByText('Serie 1/1')).toBeInTheDocument()
    expect(screen.getByText('10 reps')).toBeInTheDocument()
    expect(screen.getByText('Sans chrono')).toBeInTheDocument()
  })
})

describe('series', () => {
  it('regle les repetitions par pas de un, plancher a zero', async () => {
    const { user } = setup()
    await addFromLibrary(user, 'Pompes')

    await user.click(screen.getByRole('button', { name: 'Augmenter repetitions' }))
    expect(screen.getByText('11 reps')).toBeInTheDocument()

    const down = screen.getByRole('button', { name: 'Diminuer repetitions' })
    for (let i = 0; i < 12; i += 1) await user.click(down)
    expect(screen.getByText('0 reps')).toBeInTheDocument()
  })

  it('fait tourner le mode et masque les reps en tenir au moins', async () => {
    const { user } = setup()
    await addFromLibrary(user, 'Planche (gainage)')

    await user.click(screen.getByRole('button', { name: 'Sans chrono' }))
    expect(screen.getByRole('button', { name: 'Tenir au moins' })).toBeInTheDocument()
    // La valeur n'est lue nulle part dans ce mode : le pas disparait.
    expect(
      screen.queryByRole('button', { name: 'Augmenter repetitions' }),
    ).not.toBeInTheDocument()
    expect(screen.getByText('30s')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Tenir au moins' }))
    expect(screen.getByRole('button', { name: 'Faire en max' })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Augmenter repetitions' }),
    ).toBeInTheDocument()
  })

  it('regle les secondes par pas de cinq', async () => {
    const { user } = setup()
    await addFromLibrary(user, 'Planche (gainage)')
    await user.click(screen.getByRole('button', { name: 'Sans chrono' }))

    await user.click(screen.getByRole('button', { name: 'Augmenter secondes' }))
    expect(screen.getByText('35s')).toBeInTheDocument()
  })

  it('duplique la derniere serie a l ajout, et la retire', async () => {
    const { user } = setup()
    await addFromLibrary(user, 'Pompes')
    await user.click(screen.getByRole('button', { name: 'Augmenter repetitions' }))
    await user.click(screen.getByRole('button', { name: '+ Ajouter une serie' }))

    expect(screen.getByText('Serie 1/2')).toBeInTheDocument()
    expect(screen.getByText('Serie 2/2')).toBeInTheDocument()
    expect(screen.getAllByText('11 reps')).toHaveLength(2)

    await user.click(screen.getAllByRole('button', { name: 'Retirer' })[1])
    expect(screen.getByText('Serie 1/1')).toBeInTheDocument()
  })
})

describe('niveaux', () => {
  it('empile un niveau et bascule dessus', async () => {
    const { user } = setup()
    await addFromLibrary(user, 'Pompes')
    await user.click(screen.getByRole('button', { name: '+ Niveau' }))

    expect(screen.getByText('Niveau 2')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Aucun exercice dans ce niveau. Ajoutez-en depuis la bibliotheque.',
      ),
    ).toBeInTheDocument()
  })

  it('ne propose la suppression qu a partir de deux niveaux', async () => {
    const { user } = setup()
    expect(
      screen.queryByRole('button', { name: 'Supprimer ce niveau' }),
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '+ Niveau' }))
    expect(
      screen.getByRole('button', { name: 'Supprimer ce niveau' }),
    ).toBeInTheDocument()
  })

  it('ne propose la duplication que sur un niveau vide qui en suit un autre', async () => {
    const { user } = setup()
    const label = 'Dupliquer le niveau precedent'

    // Premier niveau : rien a dupliquer.
    expect(screen.queryByRole('button', { name: label })).not.toBeInTheDocument()

    await addFromLibrary(user, 'Pompes')
    await user.click(screen.getByRole('button', { name: '+ Niveau' }))
    expect(screen.getByRole('button', { name: label })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: label }))
    expect(screen.getByText('Pompes')).toBeInTheDocument()
    // Le niveau n'est plus vide : dupliquer ecraserait ce qui vient d'arriver.
    expect(screen.queryByRole('button', { name: label })).not.toBeInTheDocument()
  })
})

describe('repos', () => {
  it('se regle par pas de quinze et s annonce desactive a zero', async () => {
    const { user } = setup()
    expect(screen.getByText('15s')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Diminuer repos' }))
    expect(screen.getByText('desactive')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Augmenter repos' }))
    await user.click(screen.getByRole('button', { name: 'Augmenter repos' }))
    expect(screen.getByText('30s')).toBeInTheDocument()
  })
})

describe('enregistrement', () => {
  it('envoie l arbre entier et ouvre la grille', async () => {
    const { user } = setup()

    await user.type(screen.getByLabelText('Nom de la grille'), 'Push Day')
    await addFromLibrary(user, 'Pompes')
    await user.click(screen.getByRole('button', { name: '+ Niveau' }))
    await addFromLibrary(user, 'Tractions')
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }))

    expect(save).toHaveBeenCalledTimes(1)
    const input = save.mock.calls[0][0]
    expect(input).toMatchObject({ gridId: null, name: 'Push Day', restSeconds: 15 })
    expect(input.levels).toHaveLength(2)
    expect(input.levels[0].exercises[0]).toMatchObject({
      exerciseId: 'x1',
      exerciseName: 'Pompes',
    })
    expect(input.levels[1].exercises[0].exerciseId).toBe('x2')
    expect(push).toHaveBeenCalledWith('/grilles/g1')
  })

  it('affiche l erreur remontee par le serveur sans quitter le constructeur', async () => {
    save.mockResolvedValueOnce({
      gridId: null,
      error: 'Donne un nom a la grille.',
      issues: [{ path: 'name', message: 'Donne un nom a la grille.' }],
    })

    const { user } = setup()
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }))

    expect(await screen.findByText('Donne un nom a la grille.')).toBeInTheDocument()
    expect(push).not.toHaveBeenCalled()
  })
})

describe('suppression', () => {
  it('n est proposee qu en modification, et demande confirmation', async () => {
    const { user } = setup('g1')

    await user.click(screen.getByRole('button', { name: 'Supprimer cette grille' }))
    const dialog = screen.getByRole('dialog')
    expect(
      within(dialog).getByText(/Ses niveaux et sa progression partent avec elle/),
    ).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: 'Annuler' }))
    expect(remove).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Supprimer cette grille' }))
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Supprimer' }),
    )
    expect(remove).toHaveBeenCalledTimes(1)
    expect(push).toHaveBeenCalledWith('/')
  })

  it('n apparait pas a la creation', () => {
    setup(null)
    expect(
      screen.queryByRole('button', { name: 'Supprimer cette grille' }),
    ).not.toBeInTheDocument()
  })
})
