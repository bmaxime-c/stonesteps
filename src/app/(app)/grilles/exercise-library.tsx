'use client'

import { ChevronLeft } from 'lucide-react'

import { ExerciseThumb } from '@/components/exercise-thumb'
import { groupByCategory } from '@/lib/exercises/catalog'
import type { CatalogExercise } from '@/lib/exercises/model'

/**
 * Bibliotheque d'exercices.
 *
 * Sous-ecran du constructeur et non route a part : le brouillon vit en memoire,
 * une navigation le perdrait. Un tap ajoute l'exercice au niveau en cours
 * d'edition et revient aussitot — on en ajoute rarement un seul, mais on veut
 * voir ou il atterrit.
 */

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

      {groupByCategory(catalog).map(({ category, exercises: items }) => {
        return (
          <section key={category.id} className="flex flex-col gap-2.5">
            <h2 className="text-success text-xs font-bold tracking-[0.08em] uppercase">
              {category.name}
            </h2>

            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(240px,100%),1fr))] gap-2.5">
              {items.map((exercise) => (
                <button
                  key={exercise.id}
                  type="button"
                  onClick={() => onPick(exercise)}
                  className="bg-card border-border flex items-center gap-3 rounded-[14px] border p-3.5 text-left"
                >
                  <ExerciseThumb
                    name={exercise.name}
                    imageUrl={exercise.imageUrl}
                    className="size-[34px]"
                  />
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
