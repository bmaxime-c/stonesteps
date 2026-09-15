import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'

import { loadTimerCues } from '@/lib/account/queries'
import { gridProgress } from '@/lib/grids/progress'
import { loadGrid } from '@/lib/grids/queries'
import { loadLevelOutcomes } from '@/lib/session/queries'
import { buildSteps } from '@/lib/session/steps'

import { SessionRunner } from './session-runner'

export const metadata: Metadata = { title: 'Séance' }

/**
 * Seance sur le niveau en cours d'une grille.
 *
 * La route porte la grille et non la version ni le niveau : on joue la version
 * publiee la plus recente — ou celle ou le suivi a ete fige — et le niveau se
 * derive de l'historique. Une URL qui porterait l'un ou l'autre deviendrait
 * fausse des la publication suivante.
 *
 * Hors du groupe de routes (app) : la seance masque la barre de navigation.
 * C'est un mode plein ecran dont on ne sort que par la croix ou par la
 * derniere serie.
 */
export default async function SeancePage({ params }: PageProps<'/seance/[gridId]'>) {
  const { gridId } = await params

  const grid = await loadGrid(gridId)
  // La RLS suffit a filtrer : une grille qu'on ne peut pas lire ne remonte pas
  // et se presente donc comme inexistante.
  if (!grid) notFound()

  const outcomes = await loadLevelOutcomes(gridId)
  const progress = gridProgress(grid, outcomes)

  // Pas de version publiee : rien a jouer.
  if (!progress) notFound()

  // Grille terminee, ou version sans niveau.
  if (!progress.current) redirect('/')

  const level = progress.version.levels.find(
    (candidate) => candidate.id === progress.current!.id,
  )
  const steps = level ? buildSteps(level) : []
  if (steps.length === 0) redirect('/')

  const cues = await loadTimerCues()

  return (
    <SessionRunner
      cues={cues}
      plan={{
        gridId: grid.id,
        gridName: progress.version.name,
        gridVersion: progress.version.version,
        restSeconds: progress.version.restSeconds,
        levelId: progress.current.id,
        levelNumber: progress.current.position,
        levelCount: progress.version.levels.length,
        steps,
      }}
    />
  )
}
