import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { Button, buttonVariants } from '@/components/ui/button'
import { getGrid, listExercises } from '@/lib/grids/queries'
import { createClient } from '@/lib/supabase/server'

import { activateGrid, addLevel } from '../actions'
import { GridSettings } from './grid-settings'
import { LevelCard } from './level-card'
import { NewExercise } from './new-exercise'

export async function generateMetadata({
  params,
}: PageProps<'/grilles/[id]'>): Promise<Metadata> {
  const { id } = await params
  const grid = await getGrid(id)
  return { title: grid?.name ?? 'Grille' }
}

export default async function GridEditorPage({ params }: PageProps<'/grilles/[id]'>) {
  const { id } = await params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [grid, exercises] = await Promise.all([getGrid(id), listExercises()])
  if (!grid) notFound()

  // La RLS laisse lire les grilles publiques et celles des amis. L'editeur,
  // lui, reste reserve au proprietaire.
  const isOwner = grid.ownerId === user.id

  const levelIds = grid.levels.map((level) => level.id)

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-5 p-4 pb-16">
      <div>
        <Link
          href="/dashboard"
          className="text-muted-foreground hover:text-foreground text-sm"
        >
          ← Mes grilles
        </Link>
      </div>

      {isOwner ? (
        <GridSettings
          gridId={grid.id}
          name={grid.name}
          description={grid.description}
          isActive={grid.isActive}
        />
      ) : (
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold">{grid.name}</h1>
          {grid.description ? (
            <p className="text-muted-foreground text-sm">{grid.description}</p>
          ) : null}
          <p className="text-muted-foreground text-xs">
            Grille d&apos;un autre membre : consultation seule.
          </p>
        </header>
      )}

      {!grid.isActive && isOwner ? (
        <form action={activateGrid}>
          <input type="hidden" name="gridId" value={grid.id} />
          <Button type="submit" variant="outline" size="sm">
            Utiliser cette grille pour mes seances
          </Button>
        </form>
      ) : null}

      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-medium">
            {grid.levels.length} niveau{grid.levels.length > 1 ? 'x' : ''}
          </h2>
        </div>

        {grid.levels.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Aucun niveau. Ajoute le premier pour commencer a construire ta progression.
          </p>
        ) : (
          grid.levels.map((level) => (
            <LevelCard
              key={level.id}
              gridId={grid.id}
              level={level}
              levelCount={grid.levels.length}
              levelIds={levelIds}
              exercises={exercises}
            />
          ))
        )}
      </section>

      {isOwner ? (
        <div className="flex flex-wrap gap-2">
          <form action={addLevel}>
            <input type="hidden" name="gridId" value={grid.id} />
            <Button type="submit">Ajouter un niveau</Button>
          </form>
          <NewExercise gridId={grid.id} />
        </div>
      ) : (
        <Link href="/dashboard" className={buttonVariants({ variant: 'outline' })}>
          Retour
        </Link>
      )}
    </main>
  )
}
