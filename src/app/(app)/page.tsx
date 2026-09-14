import Link from 'next/link'

import { EmptyState } from '@/components/empty-state'
import { ScreenHeader } from '@/components/screen-header'
import { describeLevelContent, initials } from '@/lib/grids/describe'
import { loadGrids } from '@/lib/grids/queries'
import { currentLevel, levelStates } from '@/lib/session/level'
import { loadAllLevelOutcomes } from '@/lib/session/queries'

/**
 * Accueil : les grilles jouables, avec le niveau ou chacune en est.
 *
 * Seules les grilles publiees y figurent. Un brouillon n'est pas jouable, et
 * une carte sur laquelle on ne peut rien faire n'a rien a faire sur l'ecran
 * d'entrainement : il vit dans l'onglet Grilles jusqu'a sa publication.
 *
 * La progression n'est pas stockee : elle se deduit ici des seances validees
 * de la version en service, report de publication compris.
 */
export default async function HomePage() {
  const [grids, outcomesByGrid] = await Promise.all([loadGrids(), loadAllLevelOutcomes()])
  const playable = grids.filter((grid) => grid.published !== null)

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
              ? 'Une grille est une suite de niveaux : on valide un niveau en réussissant toutes ses séries, et le suivant se débloque.'
              : "Tes grilles sont encore en brouillon. Publie-les depuis l'onglet Grilles pour pouvoir les lancer."
          }
          action={
            <Link
              href="/grilles"
              className="bg-primary text-primary-foreground rounded-full px-5 py-3 text-[15px] font-extrabold"
            >
              {grids.length === 0 ? 'Créer ma première grille' : 'Ouvrir mes grilles'}
            </Link>
          }
        />
      ) : (
        <ul className="grid grid-cols-[repeat(auto-fit,minmax(min(280px,100%),1fr))] gap-4">
          {playable.map((grid) => {
            const version = grid.published!
            const outcomes = outcomesByGrid.get(grid.id) ?? []
            const current = currentLevel(version.levels, outcomes, version.carriedLevels)
            const states = levelStates(version.levels, outcomes, version.carriedLevels)
            const validatedCount = [...states.values()].filter(
              (state) => state === 'validated',
            ).length
            const total = version.levels.length
            const level = current
              ? version.levels.find((candidate) => candidate.id === current.id)
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
              </li>
            )
          })}
        </ul>
      )}
    </main>
  )
}
