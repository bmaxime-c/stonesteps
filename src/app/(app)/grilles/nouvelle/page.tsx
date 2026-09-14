import type { Metadata } from 'next'

import { emptyGrid } from '@/lib/grids/draft'
import { loadExerciseCatalog } from '@/lib/grids/queries'

import { GridBuilder } from '../grid-builder'

export const metadata: Metadata = { title: 'Nouvelle grille' }

export default async function NewGridPage() {
  const catalog = await loadExerciseCatalog()
  return <GridBuilder gridId={null} initial={emptyGrid()} catalog={catalog} />
}
