/**
 * Validation d'une grille avant enregistrement.
 *
 * La base porte deja ces regles en contraintes : le check de coherence du
 * chrono, les bornes de `rest_seconds`, `target_reps` positif. Les redire ici
 * n'est pas une duplication inutile — c'est ce qui permet au constructeur de
 * dire ce qui ne va pas, et ou, avant d'envoyer quoi que ce soit.
 */

import type { GridDraft } from './model'

export type GridIssue = {
  /** Chemin dans le brouillon, du genre `levels.2.exercises.0.sets.1`. */
  path: string
  message: string
}

export const REST_SECONDS_MIN = 0
export const REST_SECONDS_MAX = 300
export const TIMER_SECONDS_MIN = 5
export const GRID_NAME_MAX = 60

export function validateGrid(draft: GridDraft): GridIssue[] {
  const issues: GridIssue[] = []

  const name = draft.name.trim()
  if (name.length === 0) {
    issues.push({ path: 'name', message: 'Donne un nom a la grille.' })
  } else if (name.length > GRID_NAME_MAX) {
    issues.push({
      path: 'name',
      message: `Le nom ne depasse pas ${GRID_NAME_MAX} caracteres.`,
    })
  }

  if (
    !Number.isInteger(draft.restSeconds) ||
    draft.restSeconds < REST_SECONDS_MIN ||
    draft.restSeconds > REST_SECONDS_MAX
  ) {
    issues.push({
      path: 'restSeconds',
      message: `Le repos va de ${REST_SECONDS_MIN} a ${REST_SECONDS_MAX} secondes.`,
    })
  }

  if (draft.levels.length === 0) {
    issues.push({ path: 'levels', message: 'Une grille a au moins un niveau.' })
  }

  draft.levels.forEach((level, levelIndex) => {
    const levelPath = `levels.${levelIndex}`

    if (level.exercises.length === 0) {
      issues.push({
        path: levelPath,
        message: `Le niveau ${levelIndex + 1} n'a aucun exercice.`,
      })
    }

    level.exercises.forEach((exercise, exerciseIndex) => {
      const exercisePath = `${levelPath}.exercises.${exerciseIndex}`

      if (exercise.exerciseName.trim().length === 0) {
        issues.push({ path: exercisePath, message: "L'exercice n'a pas de nom." })
      }

      if (exercise.sets.length === 0) {
        issues.push({
          path: exercisePath,
          message: `${exercise.exerciseName || 'Cet exercice'} n'a aucune serie.`,
        })
      }

      exercise.sets.forEach((set, setIndex) => {
        const setPath = `${exercisePath}.sets.${setIndex}`

        if (!Number.isInteger(set.targetReps) || set.targetReps < 0) {
          issues.push({
            path: setPath,
            message: 'Le nombre de repetitions ne peut pas etre negatif.',
          })
        }

        // Coherence chrono : un mode sans chrono n'a pas de duree, un mode
        // chronometre en a toujours une. Sans ce couple, les deux valeurs
        // derivent l'une de l'autre et la serie devient injouable.
        if (set.timerMode === 'none') {
          if (set.timerSeconds !== null) {
            issues.push({
              path: setPath,
              message: 'Une serie sans chrono ne porte pas de duree.',
            })
          }
        } else if (set.timerSeconds === null) {
          issues.push({
            path: setPath,
            message: 'Une serie chronometree a besoin d une duree.',
          })
        } else if (
          !Number.isInteger(set.timerSeconds) ||
          set.timerSeconds < TIMER_SECONDS_MIN
        ) {
          issues.push({
            path: setPath,
            message: `La duree est d au moins ${TIMER_SECONDS_MIN} secondes.`,
          })
        }
      })
    })
  })

  return issues
}

export function isGridValid(draft: GridDraft): boolean {
  return validateGrid(draft).length === 0
}
