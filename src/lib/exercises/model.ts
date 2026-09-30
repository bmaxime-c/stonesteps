/**
 * Formes du catalogue d'exercices.
 *
 * Le catalogue integre (owner_id null) est celui que les editeurs tiennent a
 * jour ; chaque exercice y porte une categorie et, au besoin, une image.
 */

export type ExerciseCategory = {
  id: string
  name: string
  /** Ordre d'affichage : les categories creees ensuite se rangent a la suite. */
  position: number
}

export type CatalogExercise = {
  id: string
  name: string
  category: ExerciseCategory
  /** URL publique de l'image, ou null sans image. */
  imageUrl: string | null
}

/** Ce que l'editeur manipule : l'exercice, plus le chemin brut de son image. */
export type EditableCatalogExercise = CatalogExercise & {
  imagePath: string | null
  /** Vrai des qu'un niveau, de quelque grille que ce soit, le reference. */
  inUse: boolean
}
