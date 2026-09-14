import Link from 'next/link'

import { describeLevelContent, initials } from '@/lib/grids/describe'
import type { Grid } from '@/lib/grids/model'
import type { GridProgress } from '@/lib/grids/progress'

/**
 * Carte de grille, telle qu'elle apparait sur l'accueil.
 *
 * Elle porte le nom du createur des lors que la grille n'est pas la sienne :
 * c'est ce qui distingue une grille adoptee d'une grille construite, et une
 * information que l'issue demande explicitement.
 */
export function GridCard({ grid, progress }: { grid: Grid; progress: GridProgress }) {
  const { version, current, validatedCount } = progress
  const total = version.levels.length
  const level = current
    ? version.levels.find((candidate) => candidate.id === current.id)
    : undefined

  return (
    <Link
      href={`/grilles/${grid.id}`}
      className="bg-card border-border flex h-full flex-col gap-3.5 rounded-[20px] border p-5"
    >
      <div className="flex items-center gap-4">
        <span
          className="text-ink-neon flex size-[52px] shrink-0 items-center justify-center rounded-[16px] text-[17px] font-extrabold"
          style={{ background: version.accentColor }}
          aria-hidden="true"
        >
          {initials(version.name)}
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate text-[17px] font-bold">{version.name}</p>
          <p className="text-tertiary mt-0.5 text-[13px]">
            {level
              ? describeLevelContent(level.exercises)
              : 'Tous les niveaux sont validés'}
          </p>
          {!grid.owned ? (
            <p className="text-tertiary mt-0.5 truncate text-[12px]">
              de {grid.ownerName ?? 'un autre utilisateur'}
              {grid.follow?.frozenAtVersion != null ? ' · plus mise à jour' : ''}
            </p>
          ) : null}
        </div>

        <span className="text-tertiary shrink-0" aria-hidden="true">
          ›
        </span>
      </div>

      <div className="flex items-center gap-2.5">
        <div className="bg-inset h-1.5 flex-1 overflow-hidden rounded-full">
          <div
            className="h-full rounded-full"
            style={{
              width: `${total === 0 ? 0 : (validatedCount / total) * 100}%`,
              background: version.accentColor,
            }}
          />
        </div>
        <span className="text-muted-foreground text-xs font-bold whitespace-nowrap">
          {`Niveau ${current ? current.position : total}/${total}`}
        </span>
      </div>
    </Link>
  )
}
