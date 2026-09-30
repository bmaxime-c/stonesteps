import { ChevronLeft } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { EmptyState } from '@/components/empty-state'
import { ExerciseThumb } from '@/components/exercise-thumb'
import { groupByCategory } from '@/lib/exercises/catalog'
import { isExerciseEditor, loadEditableCatalog } from '@/lib/exercises/queries'

export const metadata: Metadata = { title: "Catalogue d'exercices" }

/**
 * Catalogue d'exercices, cote editeur.
 *
 * Reserve aux editeurs, un droit attribue en base. Pour les autres l'ecran
 * n'existe pas : la RLS refuserait de toute facon chaque ecriture, cette garde
 * evite d'afficher un ecran qui ne mene a rien.
 */
export default async function ExerciseCatalogPage() {
  if (!(await isExerciseEditor())) notFound()

  const exercises = await loadEditableCatalog()

  return (
    <main className="gutter mx-auto flex w-full max-w-[900px] flex-col gap-5 pt-[clamp(20px,3vw,36px)] pb-[72px]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/grilles"
            aria-label="Retour aux grilles"
            className="bg-card border-border flex size-9 shrink-0 items-center justify-center rounded-full border"
          >
            <ChevronLeft className="size-4" />
          </Link>
          <div>
            <h1 className="text-[clamp(22px,3.4vw,28px)] font-bold tracking-[-0.02em]">
              Catalogue d&apos;exercices
            </h1>
            <p className="text-tertiary mt-px text-[13px]">
              Commun à tous : ce que tu y changes vaut pour chaque grille.
            </p>
          </div>
        </div>
        <Link
          href="/grilles/exercices/nouveau"
          className="bg-primary text-primary-foreground rounded-full px-5 py-3 text-[15px] font-extrabold whitespace-nowrap shadow-[var(--glow-action)]"
        >
          Nouvel exercice
        </Link>
      </div>

      {exercises.length === 0 ? (
        <EmptyState
          title="Le catalogue est vide"
          description="Ajoute un premier exercice : il sera proposé dans la bibliothèque du constructeur."
        />
      ) : null}

      {groupByCategory(exercises).map(({ category, exercises: items }) => (
        <section key={category.id} className="flex flex-col gap-2.5">
          <h2 className="text-success text-xs font-bold tracking-[0.08em] uppercase">
            {category.name}
          </h2>

          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(260px,100%),1fr))] gap-2.5">
            {items.map((exercise) => (
              <Link
                key={exercise.id}
                href={`/grilles/exercices/${exercise.id}`}
                className="bg-card border-border flex items-center gap-3 rounded-[14px] border p-3"
              >
                <ExerciseThumb
                  name={exercise.name}
                  imageUrl={exercise.imageUrl}
                  className="size-[44px]"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold">
                    {exercise.name}
                  </span>
                  <span className="text-tertiary block text-xs">
                    {exercise.inUse ? 'Utilisé' : 'Inutilisé'}
                  </span>
                </span>
                <span className="text-tertiary shrink-0" aria-hidden="true">
                  ›
                </span>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </main>
  )
}
