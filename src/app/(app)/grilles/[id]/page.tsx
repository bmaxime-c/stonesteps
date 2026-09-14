import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { gridProgress } from '@/lib/grids/progress'
import { loadGrid } from '@/lib/grids/queries'
import { validatedAt } from '@/lib/session/level'
import { loadLevelOutcomes } from '@/lib/session/queries'

import { GridDetail } from './grid-detail'

export const metadata: Metadata = { title: 'Grille' }

/**
 * Detail d'une grille : ce qu'on y lance.
 *
 * On y voit la version qu'on joue — la derniere publiee, ou celle ou le suivi
 * a ete fige. L'edition vit dans l'onglet Grilles, et n'est offerte qu'au
 * createur.
 */
export default async function GridPage({ params }: PageProps<'/grilles/[id]'>) {
  const { id } = await params

  const grid = await loadGrid(id)
  if (!grid) notFound()

  const outcomes = await loadLevelOutcomes(id)
  const progress = gridProgress(grid, outcomes)
  if (!progress) notFound()

  const { version, states, current } = progress

  return (
    <GridDetail
      grid={{
        id: grid.id,
        name: version.name,
        accentColor: version.accentColor,
        restSeconds: version.restSeconds,
        version: version.version,
        owned: grid.owned,
        ownerName: grid.ownerName,
        hasDraft: grid.draft !== null,
        isPublic: grid.isPublic,
        frozen: grid.follow?.frozenAtVersion != null,
        removedByOwner: grid.deletedAt !== null,
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
