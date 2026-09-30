/**
 * Regles du catalogue d'exercices.
 *
 * Partagees par le formulaire et par les actions serveur : une regle recopiee
 * des deux cotes finit toujours par diverger.
 */

import type { CatalogExercise, ExerciseCategory } from './model'

export const EXERCISE_NAME_MAX = 80
export const CATEGORY_NAME_MAX = 40

/** Nom d'exercice : obligatoire, borne comme en base. */
export function validateExerciseName(value: string): string | null {
  const name = value.trim()
  if (!name) return "Donne un nom à l'exercice."
  if (name.length > EXERCISE_NAME_MAX) {
    return `Le nom ne dépasse pas ${EXERCISE_NAME_MAX} caractères.`
  }
  return null
}

/** Nom de categorie : obligatoire, borne comme en base. */
export function validateCategoryName(value: string): string | null {
  const name = value.trim()
  if (!name) return 'Donne un nom à la nouvelle catégorie.'
  if (name.length > CATEGORY_NAME_MAX) {
    return `Le nom de catégorie ne dépasse pas ${CATEGORY_NAME_MAX} caractères.`
  }
  return null
}

/**
 * Categorie existante portant ce nom, casse et espaces de bord ignores.
 *
 * Saisir « jambes » quand « Jambes » existe doit ranger l'exercice dans la
 * categorie existante, pas en creer une jumelle — la base le refuserait de
 * toute facon.
 */
export function findCategoryByName(
  categories: ExerciseCategory[],
  name: string,
): ExerciseCategory | null {
  const key = name.trim().toLowerCase()
  return categories.find((category) => category.name.trim().toLowerCase() === key) ?? null
}

/** Position d'une categorie creee : a la suite des existantes. */
export function nextCategoryPosition(
  categories: Pick<ExerciseCategory, 'position'>[],
): number {
  return categories.reduce((max, category) => Math.max(max, category.position), 0) + 1
}

/**
 * Un exercice ne se supprime que s'il n'est utilise nulle part.
 *
 * Utilise, il reste modifiable : le renommer ou changer son image profite a
 * toutes les grilles qui l'emploient.
 */
export function canDeleteExercise(exercise: { inUse: boolean }): boolean {
  return !exercise.inUse
}

export type CategorySection<T extends CatalogExercise> = {
  category: ExerciseCategory
  exercises: T[]
}

/**
 * Exercices ranges par categorie, dans l'ordre des categories.
 *
 * Les categories vides n'apparaissent pas : une section sans exercice
 * n'apporte rien a la bibliotheque. Dans une categorie, l'ordre recu est
 * conserve.
 */
export function groupByCategory<T extends CatalogExercise>(
  exercises: T[],
): CategorySection<T>[] {
  const sections = new Map<string, CategorySection<T>>()

  for (const exercise of exercises) {
    const section = sections.get(exercise.category.id)
    if (section) section.exercises.push(exercise)
    else
      sections.set(exercise.category.id, {
        category: exercise.category,
        exercises: [exercise],
      })
  }

  return [...sections.values()].sort(
    (a, b) =>
      a.category.position - b.category.position ||
      a.category.name.localeCompare(b.category.name, 'fr'),
  )
}
