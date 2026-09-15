/**
 * Progression d'un utilisateur sur une grille.
 *
 * Le calcul est le meme pour l'accueil, le detail et la seance : la version
 * jouee, le report reconstruit de proche en proche, et l'etat de chaque niveau
 * qui en decoule. Le repeter a trois endroits reviendrait a le voir diverger
 * au premier changement de regle.
 */

import type { Level } from './model'
import {
  playableVersion,
  progressionVersions,
  type Grid,
  type GridVersion,
} from './model'
import type { LevelOutcome } from '@/lib/session/model'
import {
  carryForVersions,
  currentLevel,
  levelStates,
  type LevelState,
} from '@/lib/session/level'

export type GridProgress = {
  /** Version que l'utilisateur joue : la derniere publiee, ou celle ou son suivi est fige. */
  version: GridVersion
  /** Niveaux acquis d'office, pour cet utilisateur. */
  carry: number
  current: Pick<Level, 'id' | 'position'> | null
  states: Map<string, LevelState>
  /** Nombre de niveaux franchis, pour la barre de progression. */
  validatedCount: number
}

export function gridProgress(
  grid: Grid,
  outcomes: Pick<LevelOutcome, 'levelId' | 'validated'>[],
): GridProgress | null {
  const version = playableVersion(grid)
  if (!version) return null

  const carry = carryForVersions(progressionVersions(grid), outcomes)
  const states = levelStates(version.levels, outcomes, carry)

  return {
    version,
    carry,
    current: currentLevel(version.levels, outcomes, carry),
    states,
    validatedCount: [...states.values()].filter((state) => state === 'validated').length,
  }
}
