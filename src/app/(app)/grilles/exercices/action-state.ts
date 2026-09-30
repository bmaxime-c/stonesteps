/**
 * Entrees et sorties des actions du catalogue d'exercices.
 *
 * Hors de actions.ts : un module « use server » ne peut exporter que des
 * fonctions asynchrones.
 */

export type SaveExerciseInput = {
  /** Null pour un exercice a creer. */
  id: string | null
  name: string
  /** Categorie existante choisie, ou null quand on en cree une. */
  categoryId: string | null
  /** Nom de la categorie a creer, quand `categoryId` est null. */
  newCategoryName: string | null
  /**
   * Chemin de l'image apres edition : celui d'origine si rien n'a change, un
   * nouveau chemin deja envoye au bucket, ou null pour retirer l'image.
   */
  imagePath: string | null
}

export type ExerciseActionResult = { error: string | null }
