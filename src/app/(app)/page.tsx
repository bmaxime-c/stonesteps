import Link from 'next/link'

import { EmptyState } from '@/components/empty-state'
import { ScreenHeader } from '@/components/screen-header'
import { describeLevelContent, initials } from '@/lib/grids/describe'
import { loadGrids } from '@/lib/grids/queries'
import { currentLevel, levelStates } from '@/lib/session/level'
import { loadAllLevelOutcomes } from '@/lib/session/queries'

/**
 * Accueil : les grilles de l'utilisateur, avec le niveau ou chacune en est.
 *
 * La progression n'est pas stockee : elle se deduit ici des seances validees,
 * grille par grille.
 */
export default async function HomePage() {
  const [grids, outcomesByGrid] = await Promise.all([loadGrids(), loadAllLevelOutcomes()])

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

      {grids.length === 0 ? (
        <EmptyState
          title="Aucune grille pour l'instant"
          description="Une grille est une suite de niveaux : on valide un niveau en réussissant toutes ses séries, et le suivant se débloque."
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
        <ul className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-4">
          {grids.map((grid) => {
            const outcomes = outcomesByGrid.get(grid.id) ?? []
            const current = currentLevel(grid.levels, outcomes)
            const states = levelStates(grid.levels, outcomes)
            const validatedCount = [...states.values()].filter(
              (state) => state === 'validated',
            ).length
            const total = grid.levels.length
            const level = current
              ? grid.levels.find((candidate) => candidate.id === current.id)
              : undefined

            return (
              <li key={grid.id}>
                <Link
                  href={`/grilles/${grid.id}`}
                  className="bg-card border-border flex h-full flex-col gap-3.5 rounded-[20px] border p-5"
                >
                  <div className="flex items-center gap-4">
                    <span
                      className="text-ink-neon flex size-[52px] shrink-0 items-center justify-center rounded-[16px] text-[17px] font-extrabold"
                      style={{ background: grid.accentColor }}
                      aria-hidden="true"
                    >
                      {initials(grid.name)}
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[17px] font-bold">{grid.name}</p>
                      <p className="text-tertiary mt-0.5 text-[13px]">
                        {level
                          ? describeLevelContent(level.exercises)
                          : total === 0
                            ? 'Grille vide'
                            : 'Tous les niveaux sont validés'}
                      </p>
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
                          background: grid.accentColor,
                        }}
                      />
                    </div>
                    <span className="text-muted-foreground text-xs font-bold whitespace-nowrap">
                      {total === 0
                        ? 'Aucun niveau'
                        : `Niveau ${current ? current.position : total}/${total}`}
                    </span>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </main>
  )
}
