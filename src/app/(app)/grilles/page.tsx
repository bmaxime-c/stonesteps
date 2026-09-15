import type { Metadata } from 'next'
import Link from 'next/link'

import { EmptyState } from '@/components/empty-state'
import { ScreenHeader } from '@/components/screen-header'
import { initials, plural } from '@/lib/grids/describe'
import { editableVersion, latestPublished, playableVersion } from '@/lib/grids/model'
import type { Grid } from '@/lib/grids/model'
import { loadMyGrids } from '@/lib/grids/queries'

import { DuplicateGridButton, RemoveGridButton } from './follow-buttons'

export const metadata: Metadata = { title: 'Mes grilles' }

/**
 * Menu d'edition des grilles.
 *
 * Seul endroit d'ou l'on modifie une grille : l'ecran de detail sert a lancer
 * une seance, pas a la reecrire entre deux series.
 *
 * Deux sections, parce qu'on n'y fait pas la meme chose : ses propres grilles
 * s'editent et se publient, celles qu'on suit se consultent et se retirent.
 */
export default async function GridsPage() {
  const grids = await loadMyGrids()
  const mine = grids.filter((grid) => grid.owned)
  const followed = grids.filter((grid) => !grid.owned)

  return (
    <main className="gutter mx-auto flex w-full max-w-[1040px] flex-col gap-[22px] pt-[clamp(20px,3vw,36px)] pb-[72px]">
      <ScreenHeader
        eyebrow="Édition"
        title="Mes grilles"
        action={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/grilles/decouvrir"
              className="border-border-strong text-muted-foreground rounded-full border px-4 py-3 text-[15px] font-semibold whitespace-nowrap"
            >
              Découvrir
            </Link>
            <Link
              href="/grilles/nouvelle"
              className="bg-primary text-primary-foreground rounded-full px-5 py-3 text-[15px] font-extrabold whitespace-nowrap shadow-[var(--glow-action)]"
            >
              Nouvelle grille
            </Link>
          </div>
        }
      />

      {grids.length === 0 ? (
        <EmptyState
          title="Aucune grille pour l'instant"
          description="Une grille se construit en brouillon, puis se publie. Tu peux aussi adopter une grille publiée par quelqu'un d'autre."
          action={
            <Link
              href="/grilles/nouvelle"
              className="bg-primary text-primary-foreground rounded-full px-5 py-3 text-[15px] font-extrabold"
            >
              Créer ma première grille
            </Link>
          }
        />
      ) : null}

      {mine.length > 0 ? (
        <section className="flex flex-col gap-2.5">
          <h2 className="text-tertiary text-xs font-bold tracking-[0.06em] uppercase">
            Que j&apos;ai créées
          </h2>
          {mine.map((grid) => (
            <OwnedRow key={grid.id} grid={grid} />
          ))}
        </section>
      ) : null}

      {followed.length > 0 ? (
        <section className="flex flex-col gap-2.5">
          <h2 className="text-tertiary text-xs font-bold tracking-[0.06em] uppercase">
            Que je suis
          </h2>
          {followed.map((grid) => (
            <FollowedRow key={grid.id} grid={grid} />
          ))}
        </section>
      ) : null}
    </main>
  )
}

/** Une grille dont on est le createur : elle mene au constructeur. */
function OwnedRow({ grid }: { grid: Grid }) {
  const version = editableVersion(grid)
  if (!version) return null

  const published = latestPublished(grid)

  return (
    <Link
      href={`/grilles/${grid.id}/modifier`}
      className="bg-card border-border flex items-center gap-4 rounded-[20px] border p-4"
    >
      <Badge name={version.name} color={version.accentColor} />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-base font-bold">{version.name}</p>
          {grid.draft ? (
            <span className="bg-live text-ink-neon rounded-full px-2 py-0.5 text-[11px] font-extrabold">
              Brouillon
            </span>
          ) : null}
          {grid.isPublic ? (
            <span className="bg-success text-ink-neon rounded-full px-2 py-0.5 text-[11px] font-extrabold">
              Publique
            </span>
          ) : null}
        </div>
        <p className="text-tertiary mt-0.5 text-[13px]">
          {published
            ? `Version ${published.version} publiée · ${plural(published.levels.length, 'niveau', 'niveaux')}`
            : 'Jamais publiée'}
          {grid.draft
            ? ` · brouillon à ${plural(grid.draft.levels.length, 'niveau', 'niveaux')}`
            : ''}
          {grid.followerCount > 0
            ? ` · ${plural(grid.followerCount, 'personne')} la ${grid.followerCount > 1 ? 'suivent' : 'suit'}`
            : ''}
        </p>
      </div>

      <span className="text-tertiary shrink-0" aria-hidden="true">
        ›
      </span>
    </Link>
  )
}

/**
 * Une grille suivie : on la consulte, on la retire, on ne l'edite pas.
 *
 * Seul son createur peut la modifier ; l'issue le dit, et la RLS le garantit.
 */
function FollowedRow({ grid }: { grid: Grid }) {
  const version = playableVersion(grid)
  if (!version) return null

  const frozen = grid.follow?.frozenAtVersion != null

  return (
    <div className="bg-card border-border flex items-center gap-4 rounded-[20px] border p-4">
      <Badge name={version.name} color={version.accentColor} />

      <Link href={`/grilles/${grid.id}`} className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-base font-bold">{version.name}</p>
          {frozen ? (
            <span className="bg-chip text-muted-foreground rounded-full px-2 py-0.5 text-[11px] font-extrabold">
              Plus mise à jour
            </span>
          ) : null}
        </div>
        <p className="text-tertiary mt-0.5 text-[13px]">
          de {grid.ownerName ?? 'un autre utilisateur'} · version {version.version} ·{' '}
          {plural(version.levels.length, 'niveau', 'niveaux')}
        </p>
      </Link>

      <div className="flex shrink-0 flex-wrap justify-end gap-2">
        <DuplicateGridButton gridId={grid.id} />
        <RemoveGridButton gridId={grid.id} />
      </div>
    </div>
  )
}

function Badge({ name, color }: { name: string; color: string }) {
  return (
    <span
      className="text-ink-neon flex size-11 shrink-0 items-center justify-center rounded-[14px] text-[15px] font-extrabold"
      style={{ background: color }}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  )
}
