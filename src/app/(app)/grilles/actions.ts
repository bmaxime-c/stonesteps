'use server'

import { revalidatePath } from 'next/cache'

import { copyName } from '@/lib/grids/describe'
import { unchangedPrefix } from '@/lib/grids/diff'
import { latestPublished, playableVersion } from '@/lib/grids/model'
import { loadGrid } from '@/lib/grids/queries'
import { validateGrid } from '@/lib/grids/validation'
import { logSupabaseError } from '@/lib/supabase/log'
import { createClient } from '@/lib/supabase/server'

import type {
  DeleteGridResult,
  DuplicateResult,
  GridActionResult,
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
      logSupabaseError('saveDraft/grids.insert', error)
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
 * La version passe de brouillon a publiee, et c'est elle que la seance jouera
 * — chez son createur comme chez ceux qui suivent la grille.
 *
 * On enregistre le prefixe de niveaux inchanges, et rien de plus : c'est un
 * fait universel. Le report de progression, lui, depend de ce que chacun avait
 * franchi, et se calcule a la lecture pour chaque utilisateur.
 */
export async function publishDraft(gridId: string): Promise<PublishResult> {
  const supabase = await createClient()

  const grid = await loadGrid(gridId)
  if (!grid?.draft) {
    return { version: null, error: "Cette grille n'a pas de brouillon." }
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
    return { version: null, error: issues[0].message }
  }

  const prefix = unchangedPrefix(latestPublished(grid)?.levels ?? [], grid.draft.levels)

  const { error } = await supabase
    .from('grid_versions')
    .update({
      status: 'published',
      published_at: new Date().toISOString(),
      unchanged_prefix: prefix,
    })
    .eq('id', grid.draft.id)

  if (error) {
    return { version: null, error: "Le brouillon n'a pas pu être publié." }
  }

  revalidatePath('/')
  revalidatePath('/grilles')
  revalidatePath(`/grilles/${gridId}`)

  return { version: grid.draft.version, error: null }
}

/** Abandonne le brouillon et revient a la derniere version publiee. */
export async function discardDraft(gridId: string): Promise<GridActionResult> {
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
 * Passe une grille en public ou la repasse en prive.
 *
 * Retirer le partage ne reprend rien a ceux qui suivent deja : leur suivi est
 * fige sur la derniere version publiee, ils gardent une grille jouable et leur
 * historique, mais cessent de recevoir les versions suivantes. Repartager
 * degele les suivis — ils reprennent le fil la ou la grille en est.
 */
export async function setGridVisibility(
  gridId: string,
  isPublic: boolean,
): Promise<GridActionResult> {
  const supabase = await createClient()

  const grid = await loadGrid(gridId)
  if (!grid?.owned) return { error: "Cette grille n'est pas la tienne." }

  if (!isPublic) {
    const frozenAt = latestPublished(grid)?.version
    if (frozenAt) {
      const { error } = await supabase
        .from('grid_followers')
        .update({ frozen_at_version: frozenAt })
        .eq('grid_id', gridId)
        .is('frozen_at_version', null)

      if (error) return { error: "Les suivis n'ont pas pu être figés." }
    }
  } else {
    const { error } = await supabase
      .from('grid_followers')
      .update({ frozen_at_version: null })
      .eq('grid_id', gridId)

    if (error) return { error: "Les suivis n'ont pas pu être réactivés." }
  }

  const { error } = await supabase
    .from('grids')
    .update({ is_public: isPublic })
    .eq('id', gridId)

  if (error) return { error: "La visibilité n'a pas pu être changée." }

  revalidatePath('/grilles')
  revalidatePath('/grilles/decouvrir')
  revalidatePath(`/grilles/${gridId}`)
  return { error: null }
}

/** Adopte une grille publique : elle rejoint l'accueil, avec sa progression. */
export async function followGrid(gridId: string): Promise<GridActionResult> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Session expirée. Reconnecte-toi.' }

  const { error } = await supabase
    .from('grid_followers')
    .insert({ grid_id: gridId, user_id: user.id })

  if (error) return { error: "Cette grille n'a pas pu être ajoutée." }

  revalidatePath('/')
  revalidatePath('/grilles')
  revalidatePath('/grilles/decouvrir')
  return { error: null }
}

/**
 * Retire une grille suivie.
 *
 * Les seances deja jouees restent dans les statistiques : elles portent leurs
 * snapshots, et ne dependent pas de la grille.
 */
export async function unfollowGrid(gridId: string): Promise<GridActionResult> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Session expirée. Reconnecte-toi.' }

  const { error } = await supabase
    .from('grid_followers')
    .delete()
    .eq('grid_id', gridId)
    .eq('user_id', user.id)

  if (error) return { error: "Cette grille n'a pas pu être retirée." }

  revalidatePath('/')
  revalidatePath('/grilles')
  return { error: null }
}

/**
 * Suppression d'une grille.
 *
 * Sans suiveur, elle part pour de bon avec ses versions. Avec, on ne la
 * supprime pas : une grille suivie ne peut pas disparaitre sous les pieds de
 * ceux qui l'utilisent. Elle sort de chez son createur, les suivis se figent
 * sur la derniere version publiee, et ceux qui la suivaient la gardent.
 *
 * Les seances passees survivent dans les deux cas : leurs snapshots restent
 * lisibles dans les statistiques, leurs cles etrangeres passent a null.
 */
export async function deleteGrid(gridId: string): Promise<DeleteGridResult> {
  const supabase = await createClient()

  const grid = await loadGrid(gridId)
  if (!grid?.owned) return { error: "Cette grille n'est pas la tienne.", kept: false }

  if (grid.followerCount === 0) {
    const { error } = await supabase.from('grids').delete().eq('id', gridId)
    if (error) return { error: "La grille n'a pas pu être supprimée.", kept: false }

    revalidatePath('/')
    revalidatePath('/grilles')
    return { error: null, kept: false }
  }

  const frozenAt = latestPublished(grid)?.version
  if (frozenAt) {
    await supabase
      .from('grid_followers')
      .update({ frozen_at_version: frozenAt })
      .eq('grid_id', gridId)
      .is('frozen_at_version', null)
  }

  const { error } = await supabase
    .from('grids')
    .update({ deleted_at: new Date().toISOString(), is_public: false })
    .eq('id', gridId)

  if (error) return { error: "La grille n'a pas pu être retirée.", kept: false }

  revalidatePath('/')
  revalidatePath('/grilles')
  revalidatePath('/grilles/decouvrir')
  return { error: null, kept: true }
}

/**
 * Duplique une grille dans son propre profil.
 *
 * La copie appartient a celui qui duplique : nouveau nom, version 1 publiee,
 * privee. Elle ne garde aucun lien avec l'originale — ni les versions
 * precedentes, ni la progression, ni les publications a venir. C'est bien le
 * point : on duplique pour diverger, pas pour suivre.
 *
 * Version 1 deja publiee, et non brouillon : une copie est faite pour etre
 * jouee tout de suite. Un brouillon obligerait a passer par une publication
 * pour une grille qu'on n'a pas ecrite.
 *
 * On copie ce que l'utilisateur voit — la version jouable, donc celle du gel
 * si son suivi a ete fige — et non la derniere version du createur, qu'il n'a
 * peut-etre jamais eue sous les yeux.
 */
export async function duplicateGrid(gridId: string): Promise<DuplicateResult> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { gridId: null, error: 'Session expirée. Reconnecte-toi.' }

  const source = await loadGrid(gridId)
  const version = source ? playableVersion(source) : null
  if (!source || !version) {
    return { gridId: null, error: "Cette grille n'est pas consultable." }
  }

  const { data: created, error: gridError } = await supabase
    .from('grids')
    .insert({ owner_id: user.id, is_public: false })
    .select('id')
    .single()

  if (gridError || !created) {
    return { gridId: null, error: "La copie n'a pas pu être créée." }
  }

  const { data: copy, error: versionError } = await supabase
    .from('grid_versions')
    .insert({
      grid_id: created.id,
      version: 1,
      status: 'published',
      published_at: new Date().toISOString(),
      // Rien a reporter : la copie repart de zero pour son nouveau
      // proprietaire, quelle que soit la progression de l'original.
      unchanged_prefix: 0,
      name: copyName(version.name),
      accent_color: version.accentColor,
      rest_seconds: version.restSeconds,
    })
    .select('id')
    .single()

  if (versionError || !copy) {
    await supabase.from('grids').delete().eq('id', created.id)
    return { gridId: null, error: "La copie n'a pas pu être créée." }
  }

  const treeError = await writeTree(
    supabase,
    copy.id,
    version.levels.map((level) => ({
      exercises: level.exercises.map((exercise) => ({
        exerciseId: exercise.exerciseId,
        exerciseName: exercise.exerciseName,
        sets: exercise.sets.map((set) => ({
          targetReps: set.targetReps,
          timerMode: set.timerMode,
          timerSeconds: set.timerSeconds,
        })),
      })),
    })),
  )

  if (treeError) {
    // Une grille a moitie copiee ne vaut rien : on la retire plutot que de la
    // laisser trainer dans la liste de son nouveau proprietaire.
    await supabase.from('grids').delete().eq('id', created.id)
    return { gridId: null, error: treeError }
  }

  revalidatePath('/')
  revalidatePath('/grilles')
  revalidatePath('/grilles/decouvrir')

  return { gridId: created.id, error: null }
}
