'use server'

import { revalidatePath } from 'next/cache'

import { validateGrid } from '@/lib/grids/validation'
import { createClient } from '@/lib/supabase/server'

import type { DeleteGridResult, SaveGridInput, SaveGridResult } from './action-state'

/**
 * Enregistrement d'une grille, creation comme modification.
 *
 * Le constructeur travaille sur un brouillon client et envoie l'arbre entier :
 * les niveaux, exercices et series de la grille sont **remplaces**, pas
 * fusionnes. Diffuser un arbre a trois etages ligne par ligne couterait plus
 * cher a ecrire et a relire que ce que ca economiserait.
 *
 * Le remplacement se fait en trois insertions groupees apres une suppression,
 * et non dans une transaction : PostgREST n'en expose pas. La fenetre est
 * courte et l'utilisateur est seul a ecrire dans sa grille, mais un echec en
 * cours de route laisse la grille amputee — l'erreur le dit, et reenregistrer
 * repart d'un etat propre.
 *
 * Modifier un niveau deja valide ne reecrit pas l'historique : les seances
 * passees gardent leurs snapshots, et leurs `level_id` passent a null.
 */
export async function saveGrid(input: SaveGridInput): Promise<SaveGridResult> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { gridId: null, error: 'Session expiree. Reconnecte-toi.', issues: [] }
  }

  const issues = validateGrid({
    name: input.name,
    restSeconds: input.restSeconds,
    levels: input.levels,
  })

  if (issues.length > 0) {
    return { gridId: null, error: issues[0].message, issues }
  }

  const meta = {
    name: input.name.trim(),
    accent_color: input.accentColor,
    rest_seconds: input.restSeconds,
  }

  let gridId = input.gridId

  if (gridId) {
    const { error } = await supabase.from('grids').update(meta).eq('id', gridId)
    if (error) {
      return { gridId: null, error: "La grille n'a pas pu etre enregistree.", issues: [] }
    }
  } else {
    const { data, error } = await supabase
      .from('grids')
      .insert({ ...meta, owner_id: user.id })
      .select('id')
      .single()

    if (error || !data) {
      return { gridId: null, error: "La grille n'a pas pu etre creee.", issues: [] }
    }
    gridId = data.id
  }

  // La cascade emporte level_exercises et level_sets avec les niveaux.
  const { error: clearError } = await supabase
    .from('levels')
    .delete()
    .eq('grid_id', gridId)
  if (clearError) {
    return {
      gridId: null,
      error: "Le contenu de la grille n'a pas pu etre remplace.",
      issues: [],
    }
  }

  const { data: levels, error: levelsError } = await supabase
    .from('levels')
    .insert(input.levels.map((_, index) => ({ grid_id: gridId, position: index + 1 })))
    .select('id, position')

  if (levelsError || !levels) {
    return {
      gridId: null,
      error: "Les niveaux n'ont pas pu etre enregistres.",
      issues: [],
    }
  }

  // Les identifiants reviennent sans ordre garanti : on les rattache par
  // position, la seule cle stable entre ce qui a ete envoye et ce qui revient.
  const levelIdByPosition = new Map(levels.map((level) => [level.position, level.id]))

  const exerciseRows = input.levels.flatMap((level, levelIndex) =>
    level.exercises.map((exercise, exerciseIndex) => ({
      level_id: levelIdByPosition.get(levelIndex + 1) as string,
      exercise_id: exercise.exerciseId,
      position: exerciseIndex + 1,
    })),
  )

  const { data: exercises, error: exercisesError } = await supabase
    .from('level_exercises')
    .insert(exerciseRows)
    .select('id, level_id, position')

  if (exercisesError || !exercises) {
    return {
      gridId: null,
      error: "Les exercices n'ont pas pu etre enregistres.",
      issues: [],
    }
  }

  const exerciseIdByKey = new Map(
    exercises.map((row) => [`${row.level_id}#${row.position}`, row.id]),
  )

  const setRows = input.levels.flatMap((level, levelIndex) =>
    level.exercises.flatMap((exercise, exerciseIndex) =>
      exercise.sets.map((set, setIndex) => ({
        level_exercise_id: exerciseIdByKey.get(
          `${levelIdByPosition.get(levelIndex + 1)}#${exerciseIndex + 1}`,
        ) as string,
        position: setIndex + 1,
        target_reps: set.targetReps,
        timer_mode: set.timerMode,
        timer_seconds: set.timerSeconds,
      })),
    ),
  )

  const { error: setsError } = await supabase.from('level_sets').insert(setRows)
  if (setsError) {
    return {
      gridId: null,
      error: "Les series n'ont pas pu etre enregistrees.",
      issues: [],
    }
  }

  revalidatePath('/')
  revalidatePath(`/grilles/${gridId}`)

  return { gridId, error: null, issues: [] }
}

/**
 * Suppression d'une grille.
 *
 * Emporte ses niveaux et sa progression. Les seances passees survivent : leurs
 * snapshots restent lisibles dans les statistiques, leurs cles etrangeres
 * passent a null.
 */
export async function deleteGrid(gridId: string): Promise<DeleteGridResult> {
  const supabase = await createClient()

  const { error } = await supabase.from('grids').delete().eq('id', gridId)
  if (error) return { error: "La grille n'a pas pu etre supprimee." }

  revalidatePath('/')
  return { error: null }
}
