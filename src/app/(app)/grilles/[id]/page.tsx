import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { loadGrid } from '@/lib/grids/queries'
import { levelStates, validatedAt } from '@/lib/session/level'
import { currentLevel } from '@/lib/session/level'
import { loadLevelOutcomes } from '@/lib/session/queries'

import { GridDetail } from './grid-detail'

export const metadata: Metadata = { title: 'Grille' }

export default async function GridPage({ params }: PageProps<'/grilles/[id]'>) {
  const { id } = await params

  const grid = await loadGrid(id)
  if (!grid) notFound()

  const outcomes = await loadLevelOutcomes(id)
  const states = levelStates(grid.levels, outcomes)
  const current = currentLevel(grid.levels, outcomes)

  return (
    <GridDetail
      grid={grid}
      currentLevelId={current?.id ?? null}
      levels={grid.levels.map((level) => ({
        id: level.id,
        position: level.position,
        state: states.get(level.id) ?? 'locked',
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
