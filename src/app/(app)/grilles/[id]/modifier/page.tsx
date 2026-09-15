import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { fromGrid } from '@/lib/grids/draft'
import { editableVersion, latestPublished } from '@/lib/grids/model'
import { loadExerciseCatalog, loadGrid } from '@/lib/grids/queries'

import { GridBuilder } from '../../grid-builder'

export const metadata: Metadata = { title: 'Modifier la grille' }

/**
 * Constructeur sur une grille existante.
 *
 * Reserve au createur : seul lui voit ses brouillons, edite et publie. Pour
 * les autres, la grille se consulte et se joue, et c'est tout — la RLS le
 * garantit de son cote, cette garde evite juste d'afficher un ecran qui
 * echouerait a l'enregistrement.
 *
 * Le brouillon prime : s'il en existe un, c'est lui qu'on ouvre. Sinon on part
 * d'une copie de la derniere version publiee, qui ne deviendra un brouillon
 * qu'au premier enregistrement.
 */
export default async function EditGridPage({
  params,
}: PageProps<'/grilles/[id]/modifier'>) {
  const { id } = await params

  const [grid, catalog] = await Promise.all([loadGrid(id), loadExerciseCatalog()])
  if (!grid?.owned) notFound()

  const version = editableVersion(grid)
  if (!version) notFound()

  const published = latestPublished(grid)

  return (
    <GridBuilder
      gridId={grid.id}
      initial={fromGrid(version)}
      catalog={catalog}
      draftSaved={grid.draft !== null}
      publishedVersion={published?.version ?? null}
      nextVersion={grid.draft?.version ?? (published?.version ?? 0) + 1}
      isPublic={grid.isPublic}
      followerCount={grid.followerCount}
    />
  )
}
