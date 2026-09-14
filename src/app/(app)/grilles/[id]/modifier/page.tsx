import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { fromGrid } from '@/lib/grids/draft'
import { loadExerciseCatalog, loadGrid } from '@/lib/grids/queries'

import { GridBuilder } from '../../grid-builder'

export const metadata: Metadata = { title: 'Modifier la grille' }

export default async function EditGridPage({
  params,
}: PageProps<'/grilles/[id]/modifier'>) {
  const { id } = await params

  const [grid, catalog] = await Promise.all([loadGrid(id), loadExerciseCatalog()])
  if (!grid) notFound()

  return <GridBuilder gridId={grid.id} initial={fromGrid(grid)} catalog={catalog} />
}
