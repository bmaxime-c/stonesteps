'use client'

import { ChevronLeft } from 'lucide-react'

import { initials } from '@/lib/grids/describe'
import type { CatalogExercise } from '@/lib/grids/queries'
import type { MuscleGroup } from '@/lib/grids/model'

/**
 * Bibliotheque d'exercices.
 *
 * Sous-ecran du constructeur et non route a part : le brouillon vit en memoire,
 * une navigation le perdrait. Un tap ajoute l'exercice au niveau en cours
 * d'edition et revient aussitot — on en ajoute rarement un seul, mais on veut
 * voir ou il atterrit.
 */

const GROUP_LABELS: Record<MuscleGroup, string> = {
  push: 'Poussée',
  pull: 'Tirage',
  legs: 'Jambes',
  core: 'Gainage & skills',
}

const GROUP_ORDER: MuscleGroup[] = ['push', 'pull', 'legs', 'core']

export function ExerciseLibrary({
  catalog,
  levelNumber,
  onPick,
  onBack,
}: {
  catalog: CatalogExercise[]
  levelNumber: number
  onPick: (exercise: CatalogExercise) => void
  onBack: () => void
}) {
  return (
    <main className="gutter mx-auto flex w-full max-w-[900px] flex-col gap-5 pt-[clamp(20px,3vw,36px)] pb-[72px]">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="Retour au constructeur"
          className="bg-card border-border flex size-9 shrink-0 items-center justify-center rounded-full border"
        >
          <ChevronLeft className="size-4" />
        </button>
        <div>
          <h1 className="text-[clamp(22px,3.4vw,28px)] font-bold tracking-[-0.02em]">
            Bibliothèque d&apos;exercices
          </h1>
          <p className="text-tertiary mt-px text-[13px]">
            L&apos;exercice choisi rejoint le niveau {levelNumber}.
          </p>
        </div>
      </div>

      {GROUP_ORDER.map((group) => {
        const items = catalog.filter((exercise) => exercise.muscleGroup === group)
        if (items.length === 0) return null

        return (
          <section key={group} className="flex flex-col gap-2.5">
            <h2 className="text-success text-xs font-bold tracking-[0.08em] uppercase">
              {GROUP_LABELS[group]}
            </h2>

            <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-2.5">
              {items.map((exercise) => (
                <button
                  key={exercise.id}
                  type="button"
                  onClick={() => onPick(exercise)}
                  className="bg-card border-border flex items-center gap-3 rounded-[14px] border p-3.5 text-left"
                >
                  <span
                    className="bg-chip text-success flex size-[34px] shrink-0 items-center justify-center rounded-[10px] text-xs font-bold"
                    aria-hidden="true"
                  >
                    {initials(exercise.name)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">
                    {exercise.name}
                  </span>
                  <span
                    className="text-success shrink-0 text-xl font-bold"
                    aria-hidden="true"
                  >
                    +
                  </span>
                </button>
              ))}
            </div>
          </section>
        )
      })}

      {catalog.length === 0 ? (
        <p className="bg-inset border-border text-muted-foreground rounded-[16px] border px-4 py-3.5 text-center text-[13px]">
          Le catalogue est vide.
        </p>
      ) : null}
    </main>
  )
}
