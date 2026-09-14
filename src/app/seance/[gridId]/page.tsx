import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'

import { loadGrid } from '@/lib/grids/queries'
import { currentLevel } from '@/lib/session/level'
import { loadLevelOutcomes } from '@/lib/session/queries'
import { buildSteps } from '@/lib/session/steps'

import { SessionRunner } from './session-runner'

export const metadata: Metadata = { title: 'Séance' }

/**
 * Seance sur le niveau en cours d'une grille.
 *
 * La route porte la grille et non la version ni le niveau : on joue toujours
 * la derniere version publiee, et le niveau se derive de l'historique. Une URL
 * qui porterait l'un ou l'autre deviendrait fausse des la publication
 * suivante.
 *
 * Hors du groupe de routes (app) : la seance masque la barre de navigation.
 * C'est un mode plein ecran dont on ne sort que par la croix ou par la
 * derniere serie.
 */
export default async function SeancePage({ params }: PageProps<'/seance/[gridId]'>) {
  const { gridId } = await params

  const grid = await loadGrid(gridId)
  // La RLS suffit a filtrer : une grille qui n'est pas la sienne ne remonte
  // pas, et se presente donc comme inexistante. Une grille sans version
  // publiee n'est pas jouable non plus.
  if (!grid?.published) notFound()

  const version = grid.published
  const outcomes = await loadLevelOutcomes(gridId)
  const current = currentLevel(version.levels, outcomes, version.carriedLevels)

  // Grille terminee, ou version sans niveau : il n'y a rien a jouer.
  if (!current) redirect('/')

  const level = version.levels.find((candidate) => candidate.id === current.id)
  const steps = level ? buildSteps(level) : []
  if (steps.length === 0) redirect('/')

  return (
    <SessionRunner
      plan={{
        gridId: grid.id,
        gridName: version.name,
        gridVersion: version.version,
        restSeconds: version.restSeconds,
        levelId: current.id,
        levelNumber: current.position,
        levelCount: version.levels.length,
        steps,
      }}
    />
  )
}
