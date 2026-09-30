import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { EditableCatalogExercise, ExerciseCategory } from '@/lib/exercises/model'

import type { ExerciseActionResult, SaveExerciseInput } from './action-state'
import { ExerciseForm } from './exercise-form'

const push = vi.fn()
const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh }) }))

const save = vi.fn(async (_input: SaveExerciseInput): Promise<ExerciseActionResult> => ({
  error: null,
}))
const remove = vi.fn(async (_id: string): Promise<ExerciseActionResult> => ({
  error: null,
}))
vi.mock('./actions', () => ({
  saveExercise: (input: SaveExerciseInput) => save(input),
  deleteExercise: (id: string) => remove(id),
}))

const resize = vi.fn(async (_file: File) => new Blob(['x'], { type: 'image/webp' }))
const upload = vi.fn(async (_blob: Blob): Promise<string | null> => 'new.webp')
vi.mock('./upload', () => ({
  resizeImage: (file: File) => resize(file),
  uploadExerciseImage: (blob: Blob) => upload(blob),
}))

const categories: ExerciseCategory[] = [
  { id: 'c1', name: 'Poussée', position: 1 },
  { id: 'c3', name: 'Jambes', position: 3 },
]

function exercise(over: Partial<EditableCatalogExercise> = {}): EditableCatalogExercise {
  return {
    id: 'x1',
    name: 'Squats',
    category: categories[1],
    imageUrl: 'https://img/old.webp',
    imagePath: 'old.webp',
    inUse: false,
    ...over,
  }
}

beforeEach(() => {
  push.mockClear()
  refresh.mockClear()
  save.mockClear()
  remove.mockClear()
  resize.mockClear()
  upload.mockClear()
  URL.createObjectURL = vi.fn(() => 'blob:preview')
  URL.revokeObjectURL = vi.fn()
})

describe('creation', () => {
  it('enregistre nom et categorie choisie, sans image', async () => {
    const user = userEvent.setup()
    render(<ExerciseForm exercise={null} categories={categories} />)

    await user.type(screen.getByLabelText('Nom'), 'Pompes diamant')
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }))

    expect(save).toHaveBeenCalledWith({
      id: null,
      name: 'Pompes diamant',
      categoryId: 'c1',
      newCategoryName: null,
      imagePath: null,
    })
    await waitFor(() => expect(push).toHaveBeenCalledWith('/grilles/exercices'))
  })

  it('cree une categorie depuis le formulaire', async () => {
    const user = userEvent.setup()
    render(<ExerciseForm exercise={null} categories={categories} />)

    await user.type(screen.getByLabelText('Nom'), 'Grand écart')
    await user.selectOptions(screen.getByLabelText('Catégorie'), 'Nouvelle catégorie…')
    await user.type(screen.getByLabelText('Nom de la nouvelle catégorie'), 'Mobilité')
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }))

    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ categoryId: null, newCategoryName: 'Mobilité' }),
    )
  })

  it('refuse une nouvelle categorie sans nom', async () => {
    const user = userEvent.setup()
    render(<ExerciseForm exercise={null} categories={categories} />)

    await user.type(screen.getByLabelText('Nom'), 'Grand écart')
    await user.selectOptions(screen.getByLabelText('Catégorie'), 'Nouvelle catégorie…')
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }))

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Donne un nom à la nouvelle catégorie.',
    )
    expect(save).not.toHaveBeenCalled()
  })

  it('importe une image, l envoie a l enregistrement et rattache son chemin', async () => {
    const user = userEvent.setup()
    render(<ExerciseForm exercise={null} categories={categories} />)

    await user.type(screen.getByLabelText('Nom'), 'Dips')
    await user.upload(
      screen.getByLabelText('Importer une image'),
      new File(['png'], 'dips.png', { type: 'image/png' }),
    )
    expect(resize).toHaveBeenCalledTimes(1)
    // Rien ne part au bucket avant l'enregistrement.
    expect(upload).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Enregistrer' }))

    expect(upload).toHaveBeenCalledTimes(1)
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ imagePath: 'new.webp' }))
  })

  it('refuse un format d image non pris en charge', async () => {
    const user = userEvent.setup({ applyAccept: false })
    render(<ExerciseForm exercise={null} categories={categories} />)

    await user.upload(
      screen.getByLabelText('Importer une image'),
      new File(['gif'], 'anim.gif', { type: 'image/gif' }),
    )

    expect(screen.getByRole('alert')).toHaveTextContent(
      "L'image doit être au format PNG, JPEG ou WebP.",
    )
    expect(resize).not.toHaveBeenCalled()
  })

  it('n enregistre pas si l envoi de l image echoue', async () => {
    upload.mockResolvedValueOnce(null)
    const user = userEvent.setup()
    render(<ExerciseForm exercise={null} categories={categories} />)

    await user.type(screen.getByLabelText('Nom'), 'Dips')
    await user.upload(
      screen.getByLabelText('Importer une image'),
      new File(['png'], 'dips.png', { type: 'image/png' }),
    )
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "L'image n'a pas pu être envoyée.",
    )
    expect(save).not.toHaveBeenCalled()
  })
})

describe('modification', () => {
  it('part des valeurs enregistrees et garde l image d origine', async () => {
    const user = userEvent.setup()
    render(<ExerciseForm exercise={exercise()} categories={categories} />)

    expect(screen.getByLabelText('Nom')).toHaveValue('Squats')
    expect(screen.getByLabelText('Catégorie')).toHaveValue('c3')

    await user.click(screen.getByRole('button', { name: 'Enregistrer' }))
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'x1', categoryId: 'c3', imagePath: 'old.webp' }),
    )
    expect(upload).not.toHaveBeenCalled()
  })

  it('retire l image', async () => {
    const user = userEvent.setup()
    render(<ExerciseForm exercise={exercise()} categories={categories} />)

    await user.click(screen.getByRole('button', { name: "Retirer l'image" }))
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }))

    expect(save).toHaveBeenCalledWith(expect.objectContaining({ imagePath: null }))
  })

  it('affiche l erreur remontee par le serveur', async () => {
    save.mockResolvedValueOnce({ error: 'Un exercice du catalogue porte déjà ce nom.' })
    const user = userEvent.setup()
    render(<ExerciseForm exercise={exercise()} categories={categories} />)

    await user.click(screen.getByRole('button', { name: 'Enregistrer' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Un exercice du catalogue porte déjà ce nom.',
    )
    expect(push).not.toHaveBeenCalled()
  })
})

describe('suppression', () => {
  it('supprime un exercice inutilise apres confirmation', async () => {
    const user = userEvent.setup()
    render(<ExerciseForm exercise={exercise()} categories={categories} />)

    await user.click(screen.getByRole('button', { name: "Supprimer l'exercice" }))
    expect(remove).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Supprimer' }))

    expect(remove).toHaveBeenCalledWith('x1')
    await waitFor(() => expect(push).toHaveBeenCalledWith('/grilles/exercices'))
  })

  it('ne propose pas de supprimer un exercice utilise', () => {
    render(<ExerciseForm exercise={exercise({ inUse: true })} categories={categories} />)

    expect(
      screen.queryByRole('button', { name: "Supprimer l'exercice" }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByText(
        'Utilisé par au moins une grille : cet exercice peut être modifié, pas supprimé.',
      ),
    ).toBeInTheDocument()
  })

  it('ne propose pas de supprimer a la creation', () => {
    render(<ExerciseForm exercise={null} categories={categories} />)
    expect(
      screen.queryByRole('button', { name: "Supprimer l'exercice" }),
    ).not.toBeInTheDocument()
  })
})
