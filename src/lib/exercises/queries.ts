import 'server-only'

import { env } from '@/lib/env'
import { logSupabaseError } from '@/lib/supabase/log'
import { createClient } from '@/lib/supabase/server'

import { publicImageUrl } from './image'
import type { CatalogExercise, EditableCatalogExercise, ExerciseCategory } from './model'

const EXERCISE_SELECT = 'id, name, image_path, exercise_categories ( id, name, position )'

type ExerciseRow = {
  id: string
  name: string
  image_path: string | null
  exercise_categories: ExerciseCategory | null
}

function toExercise(row: ExerciseRow): CatalogExercise & { imagePath: string | null } {
  return {
    id: row.id,
    name: row.name,
    // La cle etrangere est non nulle : l'absence ne vient que d'une lecture
    // refusee, et l'exercice reste affichable sous une categorie neutre.
    category: row.exercise_categories ?? { id: '', name: 'Autres', position: 0 },
    imageUrl: publicImageUrl(env.supabaseUrl, row.image_path),
    imagePath: row.image_path,
  }
}

/**
 * Catalogue d'exercices : les integres, plus ceux de l'utilisateur.
 *
 * La RLS decide ce qui remonte — lecture ouverte quand `owner_id` est null,
 * ses propres exercices sinon.
 */
export async function loadExerciseCatalog(): Promise<CatalogExercise[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('exercises')
    .select(EXERCISE_SELECT)
    .order('name', { ascending: true })

  if (error || !data) {
    logSupabaseError('loadExerciseCatalog', error)
    return []
  }

  return (data as unknown as ExerciseRow[]).map((row) => {
    const { imagePath: _, ...exercise } = toExercise(row)
    return exercise
  })
}

/** Toutes les categories, vides comprises, dans leur ordre d'affichage. */
export async function loadExerciseCategories(): Promise<ExerciseCategory[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('exercise_categories')
    .select('id, name, position')
    .order('position', { ascending: true })

  if (error || !data) {
    logSupabaseError('loadExerciseCategories', error)
    return []
  }
  return data
}

/**
 * L'utilisateur courant peut-il editer le catalogue ?
 *
 * Le droit s'attribue en base, sans interface : c'est la presence d'une ligne
 * dans `exercise_editors`, que la RLS ne laisse lire qu'a son titulaire.
 */
export async function isExerciseEditor(): Promise<boolean> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('is_exercise_editor')
  if (error) {
    logSupabaseError('isExerciseEditor', error)
    return false
  }
  return data === true
}

async function loadUsedExerciseIds(): Promise<Set<string>> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('used_exercise_ids')
  if (error || !data) {
    logSupabaseError('loadUsedExerciseIds', error)
    return new Set()
  }
  return new Set(data)
}

/**
 * Catalogue integre tel que l'editeur le gere : avec l'usage de chaque
 * exercice, qui decide s'il peut etre supprime.
 *
 * Les exercices personnels n'y figurent pas : l'editeur tient le catalogue
 * commun, pas celui des autres.
 */
export async function loadEditableCatalog(): Promise<EditableCatalogExercise[]> {
  const supabase = await createClient()

  const [{ data, error }, used] = await Promise.all([
    supabase
      .from('exercises')
      .select(EXERCISE_SELECT)
      .is('owner_id', null)
      .order('name', { ascending: true }),
    loadUsedExerciseIds(),
  ])

  if (error || !data) {
    logSupabaseError('loadEditableCatalog', error)
    return []
  }

  return (data as unknown as ExerciseRow[]).map((row) => ({
    ...toExercise(row),
    inUse: used.has(row.id),
  }))
}

export async function loadEditableExercise(
  id: string,
): Promise<EditableCatalogExercise | null> {
  const supabase = await createClient()

  const [{ data, error }, used] = await Promise.all([
    supabase
      .from('exercises')
      .select(EXERCISE_SELECT)
      .eq('id', id)
      .is('owner_id', null)
      .maybeSingle(),
    loadUsedExerciseIds(),
  ])

  if (error || !data) {
    logSupabaseError('loadEditableExercise', error)
    return null
  }

  return { ...toExercise(data as unknown as ExerciseRow), inUse: used.has(id) }
}
