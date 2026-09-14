/**
 * Formes du domaine, cote resultat.
 *
 * Ce qu'une seance produit, et ce que l'historique conserve. Les noms sont
 * recopies en snapshot : une seance passee doit rester lisible apres la
 * modification ou la suppression de sa grille.
 */

import type { Database } from '@/lib/database.types'

export type SetStatus = Database['public']['Enums']['set_status']
export type SetUnit = 'reps' | 's'

/** Resultat d'une serie jouee. */
export type SetResult = {
  /** Null si la serie a disparu de la grille depuis. */
  levelSetId: string | null
  /** Rang de la serie dans la seance, a partir de 0. */
  setIndex: number
  exerciseName: string
  /** Libelle affiche, du genre « Serie 2/3 ». */
  setLabel: string
  unit: SetUnit
  targetValue: number
  actualValue: number
  status: SetStatus
}

/** Une seance consolidee, telle que la lisent les statistiques. */
export type SessionRecord = {
  id: string
  gridId: string | null
  gridName: string
  levelNumber: number
  startedAt: string
  validated: boolean
  results: SetResult[]
}

/** Ce qu'il faut savoir d'une seance pour situer la progression d'une grille. */
export type LevelOutcome = {
  levelId: string | null
  levelNumber: number
  validated: boolean
  startedAt: string
}
