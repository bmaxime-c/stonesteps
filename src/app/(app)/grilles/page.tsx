import type { Metadata } from 'next'
import Link from 'next/link'

import { EmptyState } from '@/components/empty-state'
import { ScreenHeader } from '@/components/screen-header'
import { initials, plural } from '@/lib/grids/describe'
import { editableVersion } from '@/lib/grids/model'
import { loadGrids } from '@/lib/grids/queries'

export const metadata: Metadata = { title: 'Mes grilles' }

/**
 * Menu d'edition des grilles.
 *
 * Seul endroit d'ou l'on modifie une grille : l'ecran de detail sert a lancer
 * une seance, pas a la reecrire entre deux series.
 *
 * Une grille est presentee par ce que le constructeur ouvrirait — son
 * brouillon s'il en a un, sa derniere version publiee sinon — de sorte que le
 * nom affiche ici soit celui qu'on verra en ouvrant.
 */
export default async function GridsPage() {
  const grids = await loadGrids()

  return (
    <main className="gutter mx-auto flex w-full max-w-[1040px] flex-col gap-[22px] pt-[clamp(20px,3vw,36px)] pb-[72px]">
      <ScreenHeader
        eyebrow="Édition"
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

      {grids.length === 0 ? (
        <EmptyState
          title="Aucune grille pour l'instant"
          description="Une grille se construit en brouillon, puis se publie. Tant qu'elle n'est pas publiée, elle n'apparaît pas sur l'accueil et ne se lance pas."
          action={
            <Link
              href="/grilles/nouvelle"
              className="bg-primary text-primary-foreground rounded-full px-5 py-3 text-[15px] font-extrabold"
            >
              Créer ma première grille
            </Link>
          }
        />
      ) : (
        <ul className="flex flex-col gap-2.5">
          {grids.map((grid) => {
            const version = editableVersion(grid)
            if (!version) return null

            return (
              <li key={grid.id}>
                <Link
                  href={`/grilles/${grid.id}/modifier`}
                  className="bg-card border-border flex items-center gap-4 rounded-[20px] border p-4"
                >
                  <span
                    className="text-ink-neon flex size-11 shrink-0 items-center justify-center rounded-[14px] text-[15px] font-extrabold"
                    style={{ background: version.accentColor }}
                    aria-hidden="true"
                  >
                    {initials(version.name)}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-base font-bold">{version.name}</p>
                      {grid.draft ? (
                        <span className="bg-live text-ink-neon rounded-full px-2 py-0.5 text-[11px] font-extrabold">
                          Brouillon
                        </span>
                      ) : null}
                    </div>
                    <p className="text-tertiary mt-0.5 text-[13px]">
                      {grid.published
                        ? `Version ${grid.published.version} publiée · ${plural(grid.published.levels.length, 'niveau', 'niveaux')}`
                        : 'Jamais publiée'}
                      {grid.draft
                        ? ` · brouillon à ${plural(grid.draft.levels.length, 'niveau', 'niveaux')}`
                        : ''}
                    </p>
                  </div>

                  <span className="text-tertiary shrink-0" aria-hidden="true">
                    ›
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </main>
  )
}
