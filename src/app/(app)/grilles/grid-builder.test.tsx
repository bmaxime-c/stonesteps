import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { emptyGrid } from '@/lib/grids/draft'
import type { CatalogExercise } from '@/lib/grids/queries'

import type {
  DeleteGridResult,
  PublishResult,
  SaveDraftInput,
  SaveDraftResult,
} from './action-state'
import { GridBuilder } from './grid-builder'

const push = vi.fn()
const replace = vi.fn()
const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace, refresh }) }))

const save = vi.fn(async (input: SaveDraftInput): Promise<SaveDraftResult> => ({
  gridId: input.gridId ?? 'g1',
  error: null,
  issues: [],
}))
const publish = vi.fn(async (): Promise<PublishResult> => ({
  version: 2,
  carriedLevels: 3,
  error: null,
}))
const discard = vi.fn(async (): Promise<DeleteGridResult> => ({ error: null }))
const remove = vi.fn(async (): Promise<DeleteGridResult> => ({ error: null }))

vi.mock('./actions', () => ({
  saveDraft: (input: SaveDraftInput) => save(input),
  publishDraft: () => publish(),
  discardDraft: () => discard(),
  deleteGrid: () => remove(),
}))

const catalog: CatalogExercise[] = [
  { id: 'x1', name: 'Pompes', muscleGroup: 'push' },
  { id: 'x2', name: 'Tractions', muscleGroup: 'pull' },
  { id: 'x3', name: 'Planche (gainage)', muscleGroup: 'core' },
]

beforeEach(() => {
  push.mockClear()
  replace.mockClear()
  refresh.mockClear()
  save.mockClear()
  publish.mockClear()
  discard.mockClear()
  remove.mockClear()
})

type Options = {
  gridId?: string | null
  draftSaved?: boolean
  publishedVersion?: number | null
  nextVersion?: number
}

function setup({
  gridId = null,
  draftSaved = false,
  publishedVersion = null,
  nextVersion = 1,
}: Options = {}) {
  return {
    user: userEvent.setup(),
    ...render(
      <GridBuilder
        gridId={gridId}
        initial={emptyGrid()}
        catalog={catalog}
        draftSaved={draftSaved}
        publishedVersion={publishedVersion}
        nextVersion={nextVersion}
      />,
    ),
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

const publishButton = () => screen.queryByRole('button', { name: 'Publier' })

describe('bibliotheque', () => {
  it('groupe le catalogue et annonce le niveau vise', async () => {
    const { user } = setup()
    await user.click(screen.getByRole('button', { name: '+ Ajouter un exercice' }))

    expect(screen.getByText('Poussée')).toBeInTheDocument()
    expect(screen.getByText('Tirage')).toBeInTheDocument()
    expect(screen.getByText("L'exercice choisi rejoint le niveau 1.")).toBeInTheDocument()
  })

  it('ajoute l exercice avec une serie par defaut et revient au constructeur', async () => {
    const { user } = setup()
    await addFromLibrary(user, 'Pompes')

    expect(screen.queryByText('Poussée')).not.toBeInTheDocument()
    expect(screen.getByText('Pompes')).toBeInTheDocument()
    expect(screen.getByText('Série 1/1')).toBeInTheDocument()
    expect(screen.getByText('10 reps')).toBeInTheDocument()
    expect(screen.getByText('Sans chrono')).toBeInTheDocument()
  })
})

describe('series', () => {
  it('regle les repetitions par pas de un, plancher a zero', async () => {
    const { user } = setup()
    await addFromLibrary(user, 'Pompes')

    await user.click(screen.getByRole('button', { name: 'Augmenter répétitions' }))
    expect(screen.getByText('11 reps')).toBeInTheDocument()

    const down = screen.getByRole('button', { name: 'Diminuer répétitions' })
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
      screen.queryByRole('button', { name: 'Augmenter répétitions' }),
    ).not.toBeInTheDocument()
    expect(screen.getByText('30s')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Tenir au moins' }))
    expect(screen.getByRole('button', { name: 'Faire en max' })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Augmenter répétitions' }),
    ).toBeInTheDocument()
  })

  it('duplique la derniere serie a l ajout, et la retire', async () => {
    const { user } = setup()
    await addFromLibrary(user, 'Pompes')
    await user.click(screen.getByRole('button', { name: 'Augmenter répétitions' }))
    await user.click(screen.getByRole('button', { name: '+ Ajouter une série' }))

    expect(screen.getByText('Série 1/2')).toBeInTheDocument()
    expect(screen.getAllByText('11 reps')).toHaveLength(2)

    await user.click(screen.getAllByRole('button', { name: 'Retirer' })[1])
    expect(screen.getByText('Série 1/1')).toBeInTheDocument()
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
        'Aucun exercice dans ce niveau. Ajoutez-en depuis la bibliothèque.',
      ),
    ).toBeInTheDocument()
  })

  it('ne propose la duplication que sur un niveau vide qui en suit un autre', async () => {
    const { user } = setup()
    const label = 'Dupliquer le niveau précédent'

    expect(screen.queryByRole('button', { name: label })).not.toBeInTheDocument()

    await addFromLibrary(user, 'Pompes')
    await user.click(screen.getByRole('button', { name: '+ Niveau' }))
    expect(screen.getByRole('button', { name: label })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: label }))
    expect(screen.getByText('Pompes')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: label })).not.toBeInTheDocument()
  })
})

describe('brouillon', () => {
  it('annonce la version qui sera publiee', () => {
    setup({ gridId: 'g1', draftSaved: true, publishedVersion: 2, nextVersion: 3 })
    expect(
      screen.getByText('Version 2 publiée · brouillon en version 3'),
    ).toBeInTheDocument()
  })

  it('enregistre le brouillon et rien d autre', async () => {
    const { user } = setup({ gridId: 'g1', draftSaved: true, nextVersion: 1 })

    await user.type(screen.getByLabelText('Nom de la grille'), 'Push Day')
    await addFromLibrary(user, 'Pompes')
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }))

    expect(save).toHaveBeenCalledTimes(1)
    const input = save.mock.calls[0][0]
    expect(input).toMatchObject({ gridId: 'g1', name: 'Push Day', restSeconds: 15 })
    expect(input.levels[0].exercises[0]).toMatchObject({ exerciseId: 'x1' })
    expect(publish).not.toHaveBeenCalled()
  })

  it('change d URL quand la grille vient de naitre', async () => {
    const { user } = setup({ gridId: null })

    await user.type(screen.getByLabelText('Nom de la grille'), 'Push Day')
    await addFromLibrary(user, 'Pompes')
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }))

    // Le brouillon a un identifiant : un rafraichissement doit le retrouver.
    expect(replace).toHaveBeenCalledWith('/grilles/g1/modifier')
  })

  it('affiche l erreur remontee par le serveur sans quitter le constructeur', async () => {
    save.mockResolvedValueOnce({
      gridId: null,
      error: 'Donne un nom à la grille.',
      issues: [{ path: 'name', message: 'Donne un nom à la grille.' }],
    })

    const { user } = setup({ gridId: 'g1' })
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }))

    expect(await screen.findByText('Donne un nom à la grille.')).toBeInTheDocument()
    expect(push).not.toHaveBeenCalled()
  })
})

describe('publication', () => {
  it('ne s offre pas tant que rien n est enregistre', () => {
    setup({ gridId: 'g1', draftSaved: false })
    expect(publishButton()).not.toBeInTheDocument()
  })

  it('ne s offre pas sur une grille qui n existe pas encore', () => {
    setup({ gridId: null })
    expect(publishButton()).not.toBeInTheDocument()
  })

  it('s offre sur un brouillon enregistre et intact', () => {
    setup({ gridId: 'g1', draftSaved: true, publishedVersion: 1, nextVersion: 2 })
    expect(publishButton()).toBeInTheDocument()
  })

  it('disparait des que le brouillon rebouge, et le dit', async () => {
    // Publier un etat qu'on n'a pas enregistre reviendrait a publier quelque
    // chose qu'on n'a pas relu.
    const { user } = setup({ gridId: 'g1', draftSaved: true, publishedVersion: 1 })
    expect(publishButton()).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '+ Niveau' }))

    expect(publishButton()).not.toBeInTheDocument()
    expect(
      screen.getByText(
        'Modifications non enregistrées. Enregistre le brouillon pour pouvoir le publier.',
      ),
    ).toBeInTheDocument()
  })

  it('revient apres un nouvel enregistrement', async () => {
    const { user } = setup({ gridId: 'g1', draftSaved: true, publishedVersion: 1 })

    await user.click(screen.getByRole('button', { name: '+ Niveau' }))
    expect(publishButton()).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Enregistrer' }))
    expect(publishButton()).toBeInTheDocument()
  })

  it('publie et ouvre la grille', async () => {
    const { user } = setup({ gridId: 'g1', draftSaved: true, publishedVersion: 1 })

    await user.click(screen.getByRole('button', { name: 'Publier' }))

    expect(publish).toHaveBeenCalledTimes(1)
    expect(push).toHaveBeenCalledWith('/grilles/g1')
  })
})

describe('abandon et suppression', () => {
  it('ne propose d abandonner que s il y a une version publiee a retrouver', () => {
    setup({ gridId: 'g1', draftSaved: true, publishedVersion: null })
    expect(
      screen.queryByRole('button', { name: 'Abandonner le brouillon' }),
    ).not.toBeInTheDocument()
  })

  it('abandonne le brouillon apres confirmation', async () => {
    const { user } = setup({ gridId: 'g1', draftSaved: true, publishedVersion: 2 })

    await user.click(screen.getByRole('button', { name: 'Abandonner le brouillon' }))
    const dialog = screen.getByRole('dialog')
    expect(
      within(dialog).getByText(/La version 2 publiée reste en service/),
    ).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: 'Abandonner' }))
    expect(discard).toHaveBeenCalledTimes(1)
    expect(push).toHaveBeenCalledWith('/grilles')
  })

  it('supprime la grille apres confirmation', async () => {
    const { user } = setup({ gridId: 'g1', draftSaved: true, publishedVersion: 1 })

    await user.click(screen.getByRole('button', { name: 'Supprimer cette grille' }))
    const dialog = screen.getByRole('dialog')
    expect(
      within(dialog).getByText(/Toutes ses versions et sa progression partent avec elle/),
    ).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: 'Supprimer' }))
    expect(remove).toHaveBeenCalledTimes(1)
    expect(push).toHaveBeenCalledWith('/grilles')
  })

  it('n apparait pas a la creation', () => {
    setup({ gridId: null })
    expect(
      screen.queryByRole('button', { name: 'Supprimer cette grille' }),
    ).not.toBeInTheDocument()
  })
})
