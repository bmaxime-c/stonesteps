'use client'

import { ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

import { describeRest, describeSets, initials, shortDate } from '@/lib/grids/describe'
import type { Grid, LevelSet } from '@/lib/grids/model'
import type { LevelState } from '@/lib/session/level'
import { cn } from '@/lib/utils'

export type DetailLevel = {
  id: string
  position: number
  state: LevelState
  validatedAt: string | null
  exercises: { id: string; name: string; sets: LevelSet[] }[]
}

/**
 * Detail d'une grille : la frise des niveaux, puis le contenu de celui qu'on
 * consulte.
 *
 * Taper une pastille montre ce que contient ce niveau. Seul le niveau en cours
 * est lancable : un niveau valide se relit, un niveau plus loin se consulte,
 * mais on ne saute pas un cran.
 */
export function GridDetail({
  grid,
  currentLevelId,
  levels,
}: {
  grid: Pick<Grid, 'id' | 'name' | 'accentColor' | 'restSeconds'>
  currentLevelId: string | null
  levels: DetailLevel[]
}) {
  const [selectedId, setSelectedId] = useState(
    () => currentLevelId ?? levels[0]?.id ?? null,
  )
  const selected = levels.find((level) => level.id === selectedId) ?? levels[0]
  const currentPosition = levels.find((level) => level.id === currentLevelId)?.position

  return (
    <main className="gutter mx-auto flex w-full max-w-[720px] flex-col gap-3.5 pt-[clamp(20px,3vw,36px)] pb-[72px]">
      <div className="flex items-center gap-3">
        <Link
          href="/"
          aria-label="Retour à l'accueil"
          className="bg-card border-border flex size-9 shrink-0 items-center justify-center rounded-full border"
        >
          <ChevronLeft className="size-4" />
        </Link>

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[22px] font-bold">{grid.name}</h1>
          <p className="text-tertiary mt-px text-[13px]">
            {currentPosition
              ? `Niveau ${currentPosition} sur ${levels.length}`
              : levels.length === 0
                ? 'Aucun niveau'
                : 'Tous les niveaux sont validés'}{' '}
            · {describeRest(grid.restSeconds)}
          </p>
        </div>

        <Link
          href={`/grilles/${grid.id}/modifier`}
          className="bg-card border-border-strong text-muted-foreground shrink-0 rounded-full border px-4 py-2.5 text-sm font-semibold whitespace-nowrap"
        >
          Modifier
        </Link>
      </div>

      {levels.length > 0 ? (
        <>
          <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Niveaux">
            {levels.map((level) => (
              <LevelChip
                key={level.id}
                level={level}
                accentColor={grid.accentColor}
                selected={level.id === selected?.id}
                onSelect={() => setSelectedId(level.id)}
              />
            ))}
          </div>

          {selected ? (
            <>
              <p className="text-tertiary mt-1.5 text-[13px] font-bold tracking-[0.06em] uppercase">
                Niveau {selected.position}
              </p>

              {selected.exercises.map((exercise) => (
                <div
                  key={exercise.id}
                  className="bg-card border-border flex items-center gap-3.5 rounded-[16px] border p-4"
                >
                  <span
                    className="text-ink-neon flex size-10 shrink-0 items-center justify-center rounded-[12px] text-[13px] font-extrabold"
                    style={{ background: grid.accentColor }}
                    aria-hidden="true"
                  >
                    {initials(exercise.name)}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[15px] font-semibold">{exercise.name}</p>
                    <p className="text-tertiary mt-0.5 text-[13px]">
                      {describeSets(exercise.sets)}
                    </p>
                  </div>
                </div>
              ))}

              {selected.exercises.length === 0 ? (
                <p className="bg-inset border-border text-muted-foreground rounded-[16px] border px-4 py-3.5 text-center text-[13px]">
                  Ce niveau ne contient aucun exercice.
                </p>
              ) : null}

              <LevelFooter
                level={selected}
                gridId={grid.id}
                currentPosition={currentPosition}
              />
            </>
          ) : null}
        </>
      ) : (
        <p className="bg-inset border-border text-muted-foreground rounded-[16px] border px-4 py-3.5 text-center text-[13px]">
          Cette grille n&apos;a encore aucun niveau. Ouvre le constructeur pour en ajouter
          un.
        </p>
      )}
    </main>
  )
}

/**
 * Pastille de niveau.
 *
 * Valide : aplat accent, encre sombre. En cours : contour accent, fond
 * transparent. Verrouille : fond interne, texte tertiaire. La selection
 * ajoute un contour clair, qui se lit par-dessus les trois etats.
 */
function LevelChip({
  level,
  accentColor,
  selected,
  onSelect,
}: {
  level: DetailLevel
  accentColor: string
  selected: boolean
  onSelect: () => void
}) {
  const validated = level.state === 'validated'
  const current = level.state === 'current'

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={`Niveau ${level.position}${validated ? ', validé' : current ? ', en cours' : ', verrouillé'}`}
      className={cn(
        'flex h-[38px] min-w-[38px] items-center justify-center rounded-[12px] border-[1.5px] px-2.5 text-sm font-bold',
        validated && 'text-ink-neon',
        current && 'bg-transparent',
        !validated && !current && 'bg-inset text-tertiary',
      )}
      style={{
        background: validated ? accentColor : undefined,
        borderColor: selected
          ? 'var(--foreground)'
          : validated || current
            ? accentColor
            : 'var(--border)',
        color: current ? accentColor : undefined,
      }}
    >
      {level.position}
    </button>
  )
}

/** Ce qu'on peut faire du niveau consulte : le lancer, ou rien. */
function LevelFooter({
  level,
  gridId,
  currentPosition,
}: {
  level: DetailLevel
  gridId: string
  currentPosition: number | undefined
}) {
  if (level.state === 'current') {
    if (level.exercises.length === 0) return null
    return (
      <Link
        href={`/seance/${gridId}`}
        className="bg-primary text-primary-foreground mt-2 rounded-full py-[18px] text-center text-[17px] font-extrabold shadow-[0_0_30px_rgb(0_255_135/0.35)]"
      >
        Commencer le niveau {level.position}
      </Link>
    )
  }

  return (
    <p className="bg-inset border-border text-muted-foreground rounded-[16px] border px-4 py-3.5 text-center text-[13px]">
      {level.state === 'validated'
        ? level.validatedAt
          ? `Niveau validé le ${shortDate(level.validatedAt)}`
          : 'Niveau validé'
        : `Niveau verrouillé — validez d'abord le niveau ${currentPosition}`}
    </p>
  )
}
