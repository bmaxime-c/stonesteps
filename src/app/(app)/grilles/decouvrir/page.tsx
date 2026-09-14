import type { Metadata } from 'next'
import { ChevronLeft } from 'lucide-react'
import Link from 'next/link'

import { EmptyState } from '@/components/empty-state'
import { initials, plural } from '@/lib/grids/describe'
import { latestPublished } from '@/lib/grids/model'
import { loadPublicGrids } from '@/lib/grids/queries'

import { AddGridButton } from '../follow-buttons'

export const metadata: Metadata = { title: 'Découvrir' }

/**
 * Catalogue des grilles publiques.
 *
 * Sous-ecran de « Mes grilles », pas une quatrieme destination : on y vient
 * pour chercher, on en repart avec une grille adoptee.
 *
 * Une grille deja suivie n'y figure plus, ni la sienne : elles sont chez soi.
 */
export default async function DiscoverPage() {
  const grids = await loadPublicGrids()

  return (
    <main className="gutter mx-auto flex w-full max-w-[1040px] flex-col gap-[22px] pt-[clamp(20px,3vw,36px)] pb-[72px]">
      <div className="flex items-center gap-3">
        <Link
          href="/grilles"
          aria-label="Retour à mes grilles"
          className="bg-card border-border flex size-9 shrink-0 items-center justify-center rounded-full border"
        >
          <ChevronLeft className="size-4" />
        </Link>
        <div>
          <p className="text-tertiary text-sm font-medium">Grilles publiques</p>
          <h1 className="title-screen mt-0.5">Découvrir</h1>
        </div>
      </div>

      {grids.length === 0 ? (
        <EmptyState
          title="Aucune grille publique pour l'instant"
          description="Quand quelqu'un partagera une grille, elle apparaîtra ici. Tu peux aussi partager les tiennes depuis le constructeur."
        />
      ) : (
        <ul className="flex flex-col gap-2.5">
          {grids.map((grid) => {
            const version = latestPublished(grid)
            if (!version) return null

            return (
              <li
                key={grid.id}
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
                  <p className="truncate text-base font-bold">{version.name}</p>
                  <p className="text-tertiary mt-0.5 text-[13px]">
                    de {grid.ownerName ?? 'un autre utilisateur'} · version{' '}
                    {version.version} ·{' '}
                    {plural(version.levels.length, 'niveau', 'niveaux')}
                  </p>
                </div>

                <AddGridButton gridId={grid.id} />
              </li>
            )
          })}
        </ul>
      )}
    </main>
  )
}
