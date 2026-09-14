'use server'

import { revalidatePath } from 'next/cache'

import { carriedLevels } from '@/lib/grids/diff'
import { loadGrid } from '@/lib/grids/queries'
import { validateGrid } from '@/lib/grids/validation'
import { reachedLevel } from '@/lib/session/level'
import { loadLevelOutcomes } from '@/lib/session/queries'
import { createClient } from '@/lib/supabase/server'

import type {
  DeleteGridResult,
  PublishResult,
  SaveDraftInput,
  SaveDraftResult,
} from './action-state'

/**
 * Ecrit l'arbre d'une version : niveaux, exercices, series.
 *
 * Remplacement complet, pas fusion : le constructeur envoie l'arbre entier, et
 * diffuser trois etages ligne par ligne couterait plus cher a ecrire et a
 * relire que ce que ca economiserait.
 *
 * Ce n'est pas une transaction, PostgREST n'en expose pas. La fenetre est
 * courte et l'utilisateur est seul a ecrire dans sa grille ; un echec en cours
 * de route laisse le brouillon ampute, l'erreur le dit, et reenregistrer
 * repart d'un etat propre. Le brouillon, justement : rien de publie n'est en
 * jeu tant que la publication n'a pas eu lieu.
 */
async function writeTree(
  supabase: Awaited<ReturnType<typeof createClient>>,
  versionId: string,
  levels: SaveDraftInput['levels'],
): Promise<string | null> {
  // La cascade emporte level_exercises et level_sets avec les niveaux.
  const { error: clearError } = await supabase
    .from('levels')
    .delete()
    .eq('grid_version_id', versionId)
  if (clearError) return "Le contenu du brouillon n'a pas pu être remplacé."

  const { data: rows, error: levelsError } = await supabase
    .from('levels')
    .insert(
      levels.map((_, index) => ({ grid_version_id: versionId, position: index + 1 })),
    )
    .select('id, position')

  if (levelsError || !rows) return "Les niveaux n'ont pas pu être enregistrés."

  // Les identifiants reviennent sans ordre garanti : on les rattache par
  // position, la seule cle stable entre ce qui a ete envoye et ce qui revient.
  const levelIdByPosition = new Map(rows.map((row) => [row.position, row.id]))

  const exerciseRows = levels.flatMap((level, levelIndex) =>
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

  if (exercisesError || !exercises) return "Les exercices n'ont pas pu être enregistrés."

  const exerciseIdByKey = new Map(
    exercises.map((row) => [`${row.level_id}#${row.position}`, row.id]),
  )

  const setRows = levels.flatMap((level, levelIndex) =>
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
  if (setsError) return "Les séries n'ont pas pu être enregistrées."

  return null
}

/**
 * Enregistre le brouillon d'une grille.
 *
 * C'est la seule ecriture que propose le constructeur : rien ne va jamais
 * directement dans une version publiee. Une grille qui n'existe pas encore est
 * creee au passage, avec son brouillon en version 1 — elle n'apparaitra sur
 * l'accueil qu'une fois publiee.
 */
export async function saveDraft(input: SaveDraftInput): Promise<SaveDraftResult> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { gridId: null, error: 'Session expirée. Reconnecte-toi.', issues: [] }
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

  if (!gridId) {
    const { data, error } = await supabase
      .from('grids')
      .insert({ owner_id: user.id })
      .select('id')
      .single()

    if (error || !data) {
      return { gridId: null, error: "La grille n'a pas pu être créée.", issues: [] }
    }
    gridId = data.id
  }

  // Le brouillon existant, ou un nouveau numerote a la suite des publiees.
  const { data: versions, error: versionsError } = await supabase
    .from('grid_versions')
    .select('id, version, status')
    .eq('grid_id', gridId)

  if (versionsError || !versions) {
    return { gridId: null, error: "Le brouillon n'a pas pu être lu.", issues: [] }
  }

  let draftId = versions.find((version) => version.status === 'draft')?.id ?? null

  if (draftId) {
    const { error } = await supabase.from('grid_versions').update(meta).eq('id', draftId)
    if (error) {
      return {
        gridId: null,
        error: "Le brouillon n'a pas pu être enregistré.",
        issues: [],
      }
    }
  } else {
    const nextVersion =
      versions.reduce((highest, version) => Math.max(highest, version.version), 0) + 1

    const { data, error } = await supabase
      .from('grid_versions')
      .insert({ ...meta, grid_id: gridId, version: nextVersion, status: 'draft' })
      .select('id')
      .single()

    if (error || !data) {
      return { gridId: null, error: "Le brouillon n'a pas pu être créé.", issues: [] }
    }
    draftId = data.id
  }

  const treeError = await writeTree(supabase, draftId, input.levels)
  if (treeError) return { gridId: null, error: treeError, issues: [] }

  revalidatePath('/grilles')
  revalidatePath(`/grilles/${gridId}`)

  return { gridId, error: null, issues: [] }
}

/**
 * Publie le brouillon.
 *
 * La version passe de brouillon a publiee, et c'est elle que la seance jouera.
 * Le report de progression est calcule ici, une fois pour toutes : le plus
 * petit du prefixe de niveaux inchanges et de ce qui etait deja franchi. Ni
 * cadeau — on ne deverrouille pas un niveau dur en le reecrivant — ni punition
 * — corriger une faute de frappe n'efface pas des mois de progression.
 */
export async function publishDraft(gridId: string): Promise<PublishResult> {
  const supabase = await createClient()

  const grid = await loadGrid(gridId)
  if (!grid?.draft) {
    return {
      version: null,
      carriedLevels: null,
      error: "Cette grille n'a pas de brouillon.",
    }
  }

  const issues = validateGrid({
    name: grid.draft.name,
    restSeconds: grid.draft.restSeconds,
    levels: grid.draft.levels.map((level) => ({
      exercises: level.exercises.map((exercise) => ({
        exerciseName: exercise.exerciseName,
        sets: exercise.sets.map((set) => ({
          targetReps: set.targetReps,
          timerMode: set.timerMode,
          timerSeconds: set.timerSeconds,
        })),
      })),
    })),
  })

  if (issues.length > 0) {
    return { version: null, carriedLevels: null, error: issues[0].message }
  }

  const previous = grid.published
  const outcomes = previous ? await loadLevelOutcomes(gridId) : []
  const reached = previous
    ? reachedLevel(previous.levels, outcomes, previous.carriedLevels)
    : 1

  const carried = carriedLevels(previous?.levels ?? [], grid.draft.levels, reached)

  const { error } = await supabase
    .from('grid_versions')
    .update({
      status: 'published',
      published_at: new Date().toISOString(),
      carried_levels: carried,
    })
    .eq('id', grid.draft.id)

  if (error) {
    return {
      version: null,
      carriedLevels: null,
      error: "Le brouillon n'a pas pu être publié.",
    }
  }

  revalidatePath('/')
  revalidatePath('/grilles')
  revalidatePath(`/grilles/${gridId}`)

  return { version: grid.draft.version, carriedLevels: carried, error: null }
}

/** Abandonne le brouillon et revient a la derniere version publiee. */
export async function discardDraft(gridId: string): Promise<DeleteGridResult> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('grid_versions')
    .delete()
    .eq('grid_id', gridId)
    .eq('status', 'draft')

  if (error) return { error: "Le brouillon n'a pas pu être abandonné." }

  revalidatePath('/grilles')
  revalidatePath(`/grilles/${gridId}`)
  return { error: null }
}

/**
 * Suppression d'une grille.
 *
 * Emporte ses versions et sa progression. Les seances passees survivent :
 * leurs snapshots restent lisibles dans les statistiques, leurs cles
 * etrangeres passent a null.
 */
export async function deleteGrid(gridId: string): Promise<DeleteGridResult> {
  const supabase = await createClient()

  const { error } = await supabase.from('grids').delete().eq('id', gridId)
  if (error) return { error: "La grille n'a pas pu être supprimée." }

  revalidatePath('/')
  revalidatePath('/grilles')
  return { error: null }
}
