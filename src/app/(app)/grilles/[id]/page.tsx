import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { loadGrid } from '@/lib/grids/queries'
import { currentLevel, levelStates, validatedAt } from '@/lib/session/level'
import { loadLevelOutcomes } from '@/lib/session/queries'

import { GridDetail } from './grid-detail'

export const metadata: Metadata = { title: 'Grille' }

/**
 * Detail d'une grille : ce qu'on y lance.
 *
 * On y voit la version publiee, et rien d'autre. L'edition vit dans l'onglet
 * Grilles : on ne reecrit pas une grille depuis l'ecran qui sert a lancer une
 * seance.
 */
export default async function GridPage({ params }: PageProps<'/grilles/[id]'>) {
  const { id } = await params

  const grid = await loadGrid(id)
  if (!grid?.published) notFound()

  const version = grid.published
  const outcomes = await loadLevelOutcomes(id)
  const states = levelStates(version.levels, outcomes, version.carriedLevels)
  const current = currentLevel(version.levels, outcomes, version.carriedLevels)

  return (
    <GridDetail
      grid={{
        id: grid.id,
        name: version.name,
        accentColor: version.accentColor,
        restSeconds: version.restSeconds,
        version: version.version,
        hasDraft: grid.draft !== null,
      }}
      currentLevelId={current?.id ?? null}
      levels={version.levels.map((level) => ({
        id: level.id,
        position: level.position,
        state: states.get(level.id) ?? 'locked',
        // Un niveau reporte d'une publication n'a pas de seance a sa
        // position : il est valide sans date, et le dire vaut mieux que
        // d'inventer celle d'une version disparue.
        validatedAt: validatedAt(level.id, outcomes),
        exercises: level.exercises.map((exercise) => ({
          id: exercise.id,
          name: exercise.exerciseName,
          sets: exercise.sets,
        })),
      }))}
    />
  )
}
