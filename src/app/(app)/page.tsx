import Link from 'next/link'

import { EmptyState } from '@/components/empty-state'
import { GridCard } from '@/components/grid-card'
import { ScreenHeader } from '@/components/screen-header'
import { gridProgress } from '@/lib/grids/progress'
import { loadMyGrids } from '@/lib/grids/queries'
import { loadAllLevelOutcomes } from '@/lib/session/queries'

/**
 * Accueil : les grilles jouables, avec le niveau ou chacune en est.
 *
 * Les siennes et celles qu'elle suit, pourvu qu'elles aient une version
 * publiee. Un brouillon n'est pas jouable, et une carte sur laquelle on ne peut
 * rien faire n'a rien a faire sur l'ecran d'entrainement : elle vit dans
 * l'onglet Grilles jusqu'a sa publication.
 *
 * La progression n'est pas stockee : elle se deduit ici des seances validees
 * de l'utilisateur, report de publication compris — et ce report se recalcule
 * pour lui, pas pour le createur de la grille.
 */
export default async function HomePage() {
  const [grids, outcomesByGrid] = await Promise.all([
    loadMyGrids(),
    loadAllLevelOutcomes(),
  ])

  const playable = grids
    .map((grid) => ({
      grid,
      progress: gridProgress(grid, outcomesByGrid.get(grid.id) ?? []),
    }))
    .filter((entry) => entry.progress !== null)

  return (
    <main className="gutter mx-auto flex w-full max-w-[1040px] flex-col gap-[22px] pt-[clamp(20px,3vw,36px)] pb-[72px]">
      <ScreenHeader
        eyebrow="Aujourd'hui"
        title="Mes grilles"
        action={
          <Link
            href="/grilles/nouvelle"
            className="bg-primary text-primary-foreground rounded-full px-5 py-3 text-[15px] font-extrabold whitespace-nowrap shadow-[var(--glow-action)]"
          >
            Nouvelle grille
          </Link>
        }
      />

      {playable.length === 0 ? (
        <EmptyState
          title={
            grids.length === 0 ? "Aucune grille pour l'instant" : 'Aucune grille publiée'
          }
          description={
            grids.length === 0
              ? 'Construis la tienne, ou adopte une grille publiée par quelqu’un d’autre. On valide un niveau en réussissant toutes ses séries, et le suivant se débloque.'
              : "Tes grilles sont encore en brouillon. Publie-les depuis l'onglet Grilles pour pouvoir les lancer."
          }
          action={
            <Link
              href={grids.length === 0 ? '/grilles/decouvrir' : '/grilles'}
              className="bg-primary text-primary-foreground rounded-full px-5 py-3 text-[15px] font-extrabold"
            >
              {grids.length === 0 ? 'Découvrir des grilles' : 'Ouvrir mes grilles'}
            </Link>
          }
        />
      ) : (
        <ul className="grid grid-cols-[repeat(auto-fit,minmax(min(280px,100%),1fr))] gap-4">
          {playable.map(({ grid, progress }) => (
            <li key={grid.id}>
              <GridCard grid={grid} progress={progress!} />
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
