'use client'

import { ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, useTransition } from 'react'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { ExerciseThumb } from '@/components/exercise-thumb'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import {
  CATEGORY_NAME_MAX,
  EXERCISE_NAME_MAX,
  canDeleteExercise,
  validateCategoryName,
  validateExerciseName,
} from '@/lib/exercises/catalog'
import {
  ACCEPTED_IMAGE_TYPES,
  MAX_SOURCE_BYTES,
  isAcceptedImageType,
} from '@/lib/exercises/image'
import type { EditableCatalogExercise, ExerciseCategory } from '@/lib/exercises/model'

import { deleteExercise, saveExercise } from './actions'
import { resizeImage, uploadExerciseImage } from './upload'

/** Valeur du selecteur qui ouvre la saisie d'une nouvelle categorie. */
const NEW_CATEGORY = '__new__'

/**
 * Image en cours d'edition : celle d'origine, une nouvelle pas encore envoyee,
 * ou aucune.
 *
 * La nouvelle ne part au bucket qu'a l'enregistrement : annuler ne doit pas
 * laisser d'orpheline derriere soi.
 */
type ImageState =
  | { kind: 'kept'; path: string; url: string }
  | { kind: 'new'; blob: Blob; previewUrl: string }
  | { kind: 'none' }

function initialImage(exercise: EditableCatalogExercise | null): ImageState {
  if (exercise?.imagePath && exercise.imageUrl) {
    return { kind: 'kept', path: exercise.imagePath, url: exercise.imageUrl }
  }
  return { kind: 'none' }
}

/**
 * Formulaire d'un exercice du catalogue : nom, categorie, image.
 *
 * La categorie se choisit parmi les existantes, ou se cree sur place — le
 * dernier choix du selecteur ouvre un champ de saisie.
 */
export function ExerciseForm({
  exercise,
  categories,
}: {
  exercise: EditableCatalogExercise | null
  categories: ExerciseCategory[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const [name, setName] = useState(exercise?.name ?? '')
  const [categoryChoice, setCategoryChoice] = useState(
    exercise?.category.id || categories[0]?.id || NEW_CATEGORY,
  )
  const [newCategoryName, setNewCategoryName] = useState('')
  const [image, setImage] = useState<ImageState>(() => initialImage(exercise))
  const [error, setError] = useState<string | null>(null)
  const [preparingImage, setPreparingImage] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  // L'apercu d'une image choisie est une URL d'objet : elle se libere quand
  // l'image change ou que l'ecran se ferme.
  const previewUrl = image.kind === 'new' ? image.previewUrl : null
  useEffect(() => {
    if (!previewUrl) return
    return () => URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  const creatingCategory = categoryChoice === NEW_CATEGORY
  const deletable = exercise !== null && canDeleteExercise(exercise)
  const busy = pending || preparingImage

  async function pickImage(file: File | undefined) {
    if (!file) return
    setError(null)

    if (!isAcceptedImageType(file.type)) {
      setError("L'image doit être au format PNG, JPEG ou WebP.")
      return
    }
    if (file.size > MAX_SOURCE_BYTES) {
      setError("L'image est trop lourde : 15 Mo au plus.")
      return
    }

    setPreparingImage(true)
    try {
      const blob = await resizeImage(file)
      setImage({ kind: 'new', blob, previewUrl: URL.createObjectURL(blob) })
    } catch {
      setError("L'image n'a pas pu être lue.")
    } finally {
      setPreparingImage(false)
      // Choisir deux fois le meme fichier doit redeclencher la selection.
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  function submit(event: React.FormEvent) {
    event.preventDefault()

    const issue =
      validateExerciseName(name) ??
      (creatingCategory ? validateCategoryName(newCategoryName) : null)
    if (issue) {
      setError(issue)
      return
    }

    setError(null)
    startTransition(async () => {
      let imagePath: string | null = null
      if (image.kind === 'kept') imagePath = image.path
      if (image.kind === 'new') {
        imagePath = await uploadExerciseImage(image.blob)
        if (!imagePath) {
          setError("L'image n'a pas pu être envoyée.")
          return
        }
      }

      const result = await saveExercise({
        id: exercise?.id ?? null,
        name,
        categoryId: creatingCategory ? null : categoryChoice,
        newCategoryName: creatingCategory ? newCategoryName : null,
        imagePath,
      })

      if (result.error) {
        setError(result.error)
        return
      }
      router.push('/grilles/exercices')
      router.refresh()
    })
  }

  function confirmDelete() {
    if (!exercise) return
    setConfirmingDelete(false)
    startTransition(async () => {
      const result = await deleteExercise(exercise.id)
      if (result.error) {
        setError(result.error)
        return
      }
      router.push('/grilles/exercices')
      router.refresh()
    })
  }

  const shownImage =
    image.kind === 'kept' ? image.url : image.kind === 'new' ? image.previewUrl : null

  return (
    <main className="gutter mx-auto flex w-full max-w-[640px] flex-col gap-5 pt-[clamp(20px,3vw,36px)] pb-[72px]">
      <div className="flex items-center gap-3">
        <Link
          href="/grilles/exercices"
          aria-label="Retour au catalogue"
          className="bg-card border-border flex size-9 shrink-0 items-center justify-center rounded-full border"
        >
          <ChevronLeft className="size-4" />
        </Link>
        <h1 className="text-[clamp(22px,3.4vw,28px)] font-bold tracking-[-0.02em]">
          {exercise ? "Modifier l'exercice" : 'Nouvel exercice'}
        </h1>
      </div>

      <form
        onSubmit={submit}
        className="bg-card border-border flex flex-col gap-5 rounded-[20px] border p-5"
      >
        {error ? (
          <p
            role="alert"
            className="border-fail/40 bg-fail/10 rounded-[14px] border px-4 py-3 text-sm font-semibold"
          >
            {error}
          </p>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="exerciseName">Nom</Label>
          <Input
            id="exerciseName"
            value={name}
            maxLength={EXERCISE_NAME_MAX}
            onChange={(event) => setName(event.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="exerciseCategory">Catégorie</Label>
          <Select
            id="exerciseCategory"
            value={categoryChoice}
            onChange={(event) => setCategoryChoice(event.target.value)}
          >
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
            <option value={NEW_CATEGORY}>Nouvelle catégorie…</option>
          </Select>
        </div>

        {creatingCategory ? (
          <div className="space-y-2">
            <Label htmlFor="newCategoryName">Nom de la nouvelle catégorie</Label>
            <Input
              id="newCategoryName"
              value={newCategoryName}
              maxLength={CATEGORY_NAME_MAX}
              onChange={(event) => setNewCategoryName(event.target.value)}
              autoFocus
            />
          </div>
        ) : null}

        <div className="space-y-2">
          <p className="text-sm font-medium">Image</p>
          <div className="flex items-center gap-4">
            <ExerciseThumb
              name={name || '?'}
              imageUrl={shownImage}
              className="size-[88px] rounded-[14px] text-base"
            />
            <div className="flex flex-col items-start gap-2">
              <label
                htmlFor="exerciseImage"
                className="border-border-strong cursor-pointer rounded-full border px-4 py-2 text-sm font-semibold"
              >
                {preparingImage
                  ? 'Préparation…'
                  : shownImage
                    ? "Remplacer l'image"
                    : 'Importer une image'}
              </label>
              <input
                ref={fileInput}
                id="exerciseImage"
                type="file"
                accept={ACCEPTED_IMAGE_TYPES.join(',')}
                className="sr-only"
                disabled={busy}
                onChange={(event) => void pickImage(event.target.files?.[0])}
              />
              {shownImage ? (
                <button
                  type="button"
                  onClick={() => setImage({ kind: 'none' })}
                  className="text-muted-foreground text-sm font-semibold underline-offset-2 hover:underline"
                >
                  Retirer l&apos;image
                </button>
              ) : null}
            </div>
          </div>
          <p className="text-tertiary text-xs">
            PNG, JPEG ou WebP. Affichée pendant la séance pour guider le mouvement.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="submit"
            disabled={busy}
            className="bg-primary text-primary-foreground rounded-full px-5 py-2.5 text-sm font-bold disabled:opacity-50"
          >
            {pending ? 'Un instant…' : 'Enregistrer'}
          </button>
          <Link
            href="/grilles/exercices"
            className="border-border-strong rounded-full border px-5 py-2.5 text-sm font-semibold"
          >
            Annuler
          </Link>
        </div>
      </form>

      {exercise ? (
        <section className="flex flex-col gap-2">
          {deletable ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => setConfirmingDelete(true)}
              className="text-fail self-start p-2 text-[13px] font-semibold disabled:opacity-50"
            >
              Supprimer l&apos;exercice
            </button>
          ) : (
            <p className="text-tertiary text-[13px]">
              Utilisé par au moins une grille : cet exercice peut être modifié, pas
              supprimé.
            </p>
          )}
        </section>
      ) : null}

      {confirmingDelete && exercise ? (
        <ConfirmDialog
          title="Supprimer l'exercice ?"
          description={`« ${exercise.name} » disparaît du catalogue. Aucune grille ne l'utilise.`}
          confirmLabel="Supprimer"
          onCancel={() => setConfirmingDelete(false)}
          onConfirm={confirmDelete}
        />
      ) : null}
    </main>
  )
}
