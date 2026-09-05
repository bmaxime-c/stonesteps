'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import {
  TEMPLATE_GRID_DESCRIPTION,
  TEMPLATE_GRID_NAME,
  TEMPLATE_LEVELS,
} from '@/lib/grids/template'
import {
  MAX_EXERCISES_PER_LEVEL,
  hasErrors,
  validateExerciseDraft,
} from '@/lib/grids/validation'
import { createClient } from '@/lib/supabase/server'

import type { ActionState } from './action-state'

function failure(message: string): ActionState {
  return { error: message, notice: null }
}

function success(message: string | null = null): ActionState {
  return { error: null, notice: message }
}

async function requireUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  return { supabase, user }
}

function readInt(formData: FormData, key: string): number | null {
  const raw = String(formData.get(key) ?? '').trim()
  if (raw === '') return null
  const value = Number(raw)
  return Number.isFinite(value) ? value : Number.NaN
}

// ---------------------------------------------------------------------------
// Grilles
// ---------------------------------------------------------------------------

export async function createGrid(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const name = String(formData.get('name') ?? '').trim()
  if (!name) return failure('Donne un nom a ta grille.')

  const { supabase, user } = await requireUser()

  const { data, error } = await supabase
    .from('grids')
    .insert({ owner_id: user.id, name })
    .select('id')
    .single()

  if (error) return failure(error.message)

  revalidatePath('/dashboard')
  redirect(`/grilles/${data.id}`)
}

export async function createGridFromTemplate(): Promise<void> {
  const { supabase, user } = await requireUser()

  // Le modele designe ses exercices par leur nom : on resout les identifiants
  // en une requete, et on echoue si le catalogue ne les contient pas tous
  // plutot que de creer une grille amputee.
  const wantedNames = [
    ...new Set(TEMPLATE_LEVELS.flatMap((l) => l.exercises.map((e) => e.exerciseName))),
  ]

  const { data: exercises, error: exercisesError } = await supabase
    .from('exercises')
    .select('id, name')
    .in('name', wantedNames)

  if (exercisesError) throw exercisesError

  const idByName = new Map(
    (exercises ?? []).map((e) => [e.name as string, e.id as string]),
  )
  const missing = wantedNames.filter((name) => !idByName.has(name))
  if (missing.length > 0) {
    throw new Error(`Exercices absents du catalogue : ${missing.join(', ')}`)
  }

  const { data: grid, error: gridError } = await supabase
    .from('grids')
    .insert({
      owner_id: user.id,
      name: TEMPLATE_GRID_NAME,
      description: TEMPLATE_GRID_DESCRIPTION,
    })
    .select('id')
    .single()

  if (gridError) throw gridError

  const { data: levels, error: levelsError } = await supabase
    .from('levels')
    .insert(
      TEMPLATE_LEVELS.map((level, index) => ({
        grid_id: grid.id,
        position: index + 1,
        name: level.name,
      })),
    )
    .select('id, position')

  if (levelsError) throw levelsError

  const levelIdByPosition = new Map(
    (levels ?? []).map((l) => [l.position as number, l.id as string]),
  )

  const rows = TEMPLATE_LEVELS.flatMap((level, levelIndex) =>
    level.exercises.map((exercise, exerciseIndex) => ({
      level_id: levelIdByPosition.get(levelIndex + 1)!,
      exercise_id: idByName.get(exercise.exerciseName)!,
      position: exerciseIndex + 1,
      sets: exercise.sets,
      reps: exercise.reps,
      timer_mode: exercise.timerMode,
      timer_seconds: exercise.timerSeconds,
    })),
  )

  const { error: rowsError } = await supabase.from('level_exercises').insert(rows)
  if (rowsError) throw rowsError

  revalidatePath('/dashboard')
  redirect(`/grilles/${grid.id}`)
}

export async function renameGrid(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const gridId = String(formData.get('gridId') ?? '')
  const name = String(formData.get('name') ?? '').trim()
  const description = String(formData.get('description') ?? '').trim()

  if (!name) return failure('Le nom ne peut pas etre vide.')

  const { supabase } = await requireUser()

  const { error } = await supabase
    .from('grids')
    .update({ name, description: description || null })
    .eq('id', gridId)

  if (error) return failure(error.message)

  revalidatePath(`/grilles/${gridId}`)
  revalidatePath('/dashboard')
  return success('Grille enregistree.')
}

export async function deleteGrid(formData: FormData): Promise<void> {
  const gridId = String(formData.get('gridId') ?? '')
  const { supabase } = await requireUser()

  const { error } = await supabase.from('grids').delete().eq('id', gridId)
  if (error) throw error

  revalidatePath('/dashboard')
  redirect('/dashboard')
}

export async function activateGrid(formData: FormData): Promise<void> {
  const gridId = String(formData.get('gridId') ?? '')
  const { supabase } = await requireUser()

  // Passe par une fonction SQL : l'index unique partiel interdit d'avoir deux
  // grilles actives, meme un court instant entre deux requetes.
  const { error } = await supabase.rpc('set_active_grid', { p_grid_id: gridId })
  if (error) throw error

  revalidatePath('/dashboard')
  revalidatePath(`/grilles/${gridId}`)
}

// ---------------------------------------------------------------------------
// Niveaux
// ---------------------------------------------------------------------------

export async function addLevel(formData: FormData): Promise<void> {
  const gridId = String(formData.get('gridId') ?? '')
  const { supabase } = await requireUser()

  const { count, error: countError } = await supabase
    .from('levels')
    .select('id', { count: 'exact', head: true })
    .eq('grid_id', gridId)

  if (countError) throw countError

  const { error } = await supabase
    .from('levels')
    .insert({ grid_id: gridId, position: (count ?? 0) + 1 })

  if (error) throw error

  revalidatePath(`/grilles/${gridId}`)
}

export async function renameLevel(formData: FormData): Promise<void> {
  const gridId = String(formData.get('gridId') ?? '')
  const levelId = String(formData.get('levelId') ?? '')
  const name = String(formData.get('name') ?? '').trim()

  const { supabase } = await requireUser()

  const { error } = await supabase
    .from('levels')
    .update({ name: name || null })
    .eq('id', levelId)

  if (error) throw error

  revalidatePath(`/grilles/${gridId}`)
}

export async function deleteLevel(formData: FormData): Promise<void> {
  const gridId = String(formData.get('gridId') ?? '')
  const levelId = String(formData.get('levelId') ?? '')

  const { supabase } = await requireUser()

  // Fonction SQL : la suppression et le resserrage des positions doivent tenir
  // dans une seule transaction.
  const { error } = await supabase.rpc('delete_level', { p_level_id: levelId })
  if (error) throw error

  revalidatePath(`/grilles/${gridId}`)
}

export async function duplicateLevel(formData: FormData): Promise<void> {
  const gridId = String(formData.get('gridId') ?? '')
  const levelId = String(formData.get('levelId') ?? '')

  const { supabase } = await requireUser()

  // Fonction SQL : inserer la copie suppose de decaler les positions
  // suivantes, ce qui ne tient que dans une transaction unique.
  const { error } = await supabase.rpc('duplicate_level', { p_level_id: levelId })
  if (error) throw error

  revalidatePath(`/grilles/${gridId}`)
}

export async function reorderLevels(formData: FormData): Promise<void> {
  const gridId = String(formData.get('gridId') ?? '')
  const orderedIds = String(formData.get('orderedIds') ?? '')
    .split(',')
    .filter(Boolean)

  const { supabase } = await requireUser()

  const { error } = await supabase.rpc('reorder_levels', {
    p_grid_id: gridId,
    p_level_ids: orderedIds,
  })
  if (error) throw error

  revalidatePath(`/grilles/${gridId}`)
}

// ---------------------------------------------------------------------------
// Exercices d'un niveau
// ---------------------------------------------------------------------------

export async function addLevelExercise(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const gridId = String(formData.get('gridId') ?? '')
  const levelId = String(formData.get('levelId') ?? '')

  const draft = {
    exerciseId: String(formData.get('exerciseId') ?? ''),
    sets: readInt(formData, 'sets') ?? Number.NaN,
    reps: readInt(formData, 'reps'),
    timerMode: String(formData.get('timerMode') ?? 'none') as
      'none' | 'minimal' | 'strict',
    timerSeconds: readInt(formData, 'timerSeconds'),
  }

  // Un chrono desactive n'a pas de duree, quelle que soit la valeur restee
  // dans le champ masque.
  if (draft.timerMode === 'none') draft.timerSeconds = null

  const errors = validateExerciseDraft(draft)
  if (hasErrors(errors)) {
    return failure(Object.values(errors)[0]!)
  }

  const { supabase } = await requireUser()

  const { count, error: countError } = await supabase
    .from('level_exercises')
    .select('id', { count: 'exact', head: true })
    .eq('level_id', levelId)

  if (countError) return failure(countError.message)

  if ((count ?? 0) >= MAX_EXERCISES_PER_LEVEL) {
    return failure(`Un niveau ne peut pas depasser ${MAX_EXERCISES_PER_LEVEL} exercices.`)
  }

  const { error } = await supabase.from('level_exercises').insert({
    level_id: levelId,
    exercise_id: draft.exerciseId,
    position: (count ?? 0) + 1,
    sets: draft.sets,
    reps: draft.reps,
    timer_mode: draft.timerMode,
    timer_seconds: draft.timerSeconds,
  })

  if (error) return failure(error.message)

  revalidatePath(`/grilles/${gridId}`)
  return success()
}

export async function updateLevelExercise(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const gridId = String(formData.get('gridId') ?? '')
  const rowId = String(formData.get('rowId') ?? '')

  const draft = {
    exerciseId: String(formData.get('exerciseId') ?? ''),
    sets: readInt(formData, 'sets') ?? Number.NaN,
    reps: readInt(formData, 'reps'),
    timerMode: String(formData.get('timerMode') ?? 'none') as
      'none' | 'minimal' | 'strict',
    timerSeconds: readInt(formData, 'timerSeconds'),
  }

  if (draft.timerMode === 'none') draft.timerSeconds = null

  const errors = validateExerciseDraft(draft)
  if (hasErrors(errors)) {
    return failure(Object.values(errors)[0]!)
  }

  const { supabase } = await requireUser()

  const { error } = await supabase
    .from('level_exercises')
    .update({
      exercise_id: draft.exerciseId,
      sets: draft.sets,
      reps: draft.reps,
      timer_mode: draft.timerMode,
      timer_seconds: draft.timerSeconds,
    })
    .eq('id', rowId)

  if (error) return failure(error.message)

  revalidatePath(`/grilles/${gridId}`)
  return success('Exercice enregistre.')
}

export async function deleteLevelExercise(formData: FormData): Promise<void> {
  const gridId = String(formData.get('gridId') ?? '')
  const rowId = String(formData.get('rowId') ?? '')

  const { supabase } = await requireUser()

  const { error } = await supabase.rpc('delete_level_exercise', { p_row_id: rowId })
  if (error) throw error

  revalidatePath(`/grilles/${gridId}`)
}

export async function duplicateLevelExercise(formData: FormData): Promise<void> {
  const gridId = String(formData.get('gridId') ?? '')
  const rowId = String(formData.get('rowId') ?? '')

  const { supabase } = await requireUser()

  const { error } = await supabase.rpc('duplicate_level_exercise', { p_row_id: rowId })
  if (error) throw error

  revalidatePath(`/grilles/${gridId}`)
}

export async function reorderLevelExercises(formData: FormData): Promise<void> {
  const gridId = String(formData.get('gridId') ?? '')
  const levelId = String(formData.get('levelId') ?? '')
  const orderedIds = String(formData.get('orderedIds') ?? '')
    .split(',')
    .filter(Boolean)

  const { supabase } = await requireUser()

  const { error } = await supabase.rpc('reorder_level_exercises', {
    p_level_id: levelId,
    p_row_ids: orderedIds,
  })
  if (error) throw error

  revalidatePath(`/grilles/${gridId}`)
}

// ---------------------------------------------------------------------------
// Exercices personnels
// ---------------------------------------------------------------------------

export async function createExercise(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const gridId = String(formData.get('gridId') ?? '')
  const name = String(formData.get('name') ?? '').trim()
  const category = String(formData.get('category') ?? '').trim()

  if (!name) return failure("Donne un nom a l'exercice.")

  const { supabase, user } = await requireUser()

  const { error } = await supabase
    .from('exercises')
    .insert({ owner_id: user.id, name, category: category || null, is_builtin: false })

  if (error) return failure(error.message)

  revalidatePath(`/grilles/${gridId}`)
  return success(`« ${name} » ajoute a ton catalogue.`)
}
