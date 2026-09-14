import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'

import { loadGrid } from '@/lib/grids/queries'
import { currentLevel } from '@/lib/session/level'
import { loadLevelOutcomes } from '@/lib/session/queries'
import { buildSteps } from '@/lib/session/steps'

import { SessionRunner } from './session-runner'

export const metadata: Metadata = { title: 'Seance' }

/**
 * Seance sur le niveau en cours d'une grille.
 *
 * La route porte la grille et non le niveau : le niveau se derive de
 * l'historique, et une URL qui porterait un numero de niveau deviendrait
 * fausse des qu'une seance est validee.
 *
 * Hors du groupe de routes (app) : la seance masque la barre de navigation.
 * C'est un mode plein ecran dont on ne sort que par la croix ou par la
 * derniere serie.
 */
export default async function SeancePage({ params }: PageProps<'/seance/[gridId]'>) {
  const { gridId } = await params

  const grid = await loadGrid(gridId)
  // La RLS suffit a filtrer : une grille qui n'est pas la sienne ne remonte
  // pas, et se presente donc comme inexistante.
  if (!grid) notFound()

  const outcomes = await loadLevelOutcomes(gridId)
  const current = currentLevel(grid.levels, outcomes)

  // Grille terminee, ou grille sans niveau : il n'y a rien a jouer.
  if (!current) redirect('/')

  const level = grid.levels.find((candidate) => candidate.id === current.id)
  const steps = level ? buildSteps(level) : []
  if (steps.length === 0) redirect('/')

  return (
    <SessionRunner
      plan={{
        gridId: grid.id,
        gridName: grid.name,
        restSeconds: grid.restSeconds,
        levelId: current.id,
        levelNumber: current.position,
        levelCount: grid.levels.length,
        steps,
      }}
    />
  )
}
