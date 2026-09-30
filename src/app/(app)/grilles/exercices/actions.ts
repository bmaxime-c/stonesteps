'use server'

import { revalidatePath } from 'next/cache'

import {
  findCategoryByName,
  nextCategoryPosition,
  validateCategoryName,
  validateExerciseName,
} from '@/lib/exercises/catalog'
import { EXERCISE_IMAGE_BUCKET, isValidImagePath } from '@/lib/exercises/image'
import { isExerciseEditor, loadExerciseCategories } from '@/lib/exercises/queries'
import { logSupabaseError } from '@/lib/supabase/log'
import { createClient } from '@/lib/supabase/server'

import type { ExerciseActionResult, SaveExerciseInput } from './action-state'

type Supabase = Awaited<ReturnType<typeof createClient>>

const NOT_EDITOR = "Tu n'as pas le droit de modifier le catalogue d'exercices."

/** Violation d'une contrainte d'unicite Postgres. */
const UNIQUE_VIOLATION = '23505'
/** Violation de cle etrangere : ici, un niveau reference encore l'exercice. */
const FOREIGN_KEY_VIOLATION = '23503'

function revalidateCatalog() {
  revalidatePath('/grilles/exercices')
  revalidatePath('/grilles/nouvelle')
  // Le constructeur et la seance lisent le nom et l'image de l'exercice.
  revalidatePath('/', 'layout')
}

/**
 * Categorie a ranger sur l'exercice : celle choisie, ou celle a creer.
 *
 * Un nom qui existe deja, a la casse pres, reprend la categorie existante
 * plutot que d'en creer une jumelle.
 */
async function resolveCategory(
  supabase: Supabase,
  input: SaveExerciseInput,
): Promise<{ id: string; error: null } | { id: null; error: string }> {
  if (input.categoryId) return { id: input.categoryId, error: null }

  const name = (input.newCategoryName ?? '').trim()
  const issue = validateCategoryName(name)
  if (issue) return { id: null, error: issue }

  const categories = await loadExerciseCategories()
  const existing = findCategoryByName(categories, name)
  if (existing) return { id: existing.id, error: null }

  const { data, error } = await supabase
    .from('exercise_categories')
    .insert({ name, position: nextCategoryPosition(categories) })
    .select('id')
    .single()

  if (error?.code === UNIQUE_VIOLATION) {
    // Creee entre-temps par un autre editeur : on la reprend.
    const again = findCategoryByName(await loadExerciseCategories(), name)
    if (again) return { id: again.id, error: null }
  }

  if (error || !data) {
    logSupabaseError('resolveCategory', error)
    return { id: null, error: "La catégorie n'a pas pu être créée." }
  }
  return { id: data.id, error: null }
}

async function removeImage(supabase: Supabase, path: string | null) {
  if (!path) return
  const { error } = await supabase.storage.from(EXERCISE_IMAGE_BUCKET).remove([path])
  // Une image orpheline ne gene personne : on le trace, sans faire echouer
  // l'enregistrement pour autant.
  if (error) logSupabaseError('removeImage', error)
}

/**
 * Cree ou modifie un exercice du catalogue integre.
 *
 * L'image a deja ete envoyee au bucket par le navigateur — une action serveur
 * plafonne la taille de ce qu'elle recoit. Il ne reste ici qu'a rattacher son
 * chemin, et a retirer l'ancienne image quand elle est remplacee.
 */
export async function saveExercise(
  input: SaveExerciseInput,
): Promise<ExerciseActionResult> {
  const name = input.name.trim()
  const issue = validateExerciseName(name)
  if (issue) return { error: issue }

  if (input.imagePath !== null && !isValidImagePath(input.imagePath)) {
    return { error: "L'image n'est pas valide." }
  }

  if (!(await isExerciseEditor())) return { error: NOT_EDITOR }

  const supabase = await createClient()

  // L'image d'avant, pour la retirer si elle est remplacee ou supprimee.
  let previousImage: string | null = null
  if (input.id) {
    const { data: current, error } = await supabase
      .from('exercises')
      .select('image_path')
      .eq('id', input.id)
      .is('owner_id', null)
      .maybeSingle()
    if (error || !current) {
      logSupabaseError('saveExercise.current', error)
      return { error: "Cet exercice n'existe plus." }
    }
    previousImage = current.image_path
  }

  const discardUpload = async () => {
    if (input.imagePath && input.imagePath !== previousImage) {
      await removeImage(supabase, input.imagePath)
    }
  }

  const category = await resolveCategory(supabase, input)
  if (category.error !== null) {
    await discardUpload()
    return { error: category.error }
  }

  const row = { name, category_id: category.id, image_path: input.imagePath }

  const { error } = input.id
    ? await supabase.from('exercises').update(row).eq('id', input.id).is('owner_id', null)
    : await supabase.from('exercises').insert({ ...row, owner_id: null })

  if (error) {
    logSupabaseError('saveExercise', error)
    await discardUpload()
    if (error.code === UNIQUE_VIOLATION) {
      return { error: 'Un exercice du catalogue porte déjà ce nom.' }
    }
    return { error: "L'exercice n'a pas pu être enregistré." }
  }

  if (previousImage && previousImage !== input.imagePath) {
    await removeImage(supabase, previousImage)
  }

  revalidateCatalog()
  return { error: null }
}

/**
 * Supprime un exercice inutilise.
 *
 * La cle etrangere de level_exercises est en on delete restrict : c'est elle
 * qui garantit qu'un exercice utilise ne part pas, meme si l'ecran l'avait
 * cru libre.
 */
export async function deleteExercise(id: string): Promise<ExerciseActionResult> {
  if (!(await isExerciseEditor())) return { error: NOT_EDITOR }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('exercises')
    .delete()
    .eq('id', id)
    .is('owner_id', null)
    .select('image_path')
    .maybeSingle()

  if (error?.code === FOREIGN_KEY_VIOLATION) {
    return {
      error:
        'Cet exercice est utilisé par au moins une grille : il peut être modifié, pas supprimé.',
    }
  }
  if (error || !data) {
    logSupabaseError('deleteExercise', error)
    return { error: "L'exercice n'a pas pu être supprimé." }
  }

  await removeImage(supabase, data.image_path)

  revalidateCatalog()
  return { error: null }
}
