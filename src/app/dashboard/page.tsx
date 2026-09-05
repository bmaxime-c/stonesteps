import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { buttonVariants } from '@/components/ui/button'
import { listGrids } from '@/lib/grids/queries'
import { loadActiveGridPlan, type SessionStart } from '@/lib/session/queries'
import { createClient } from '@/lib/supabase/server'

import { activateGrid, createGridFromTemplate } from '../grilles/actions'
import { NewGrid } from './new-grid'
import { SignOutButton } from './sign-out-button'

export const metadata: Metadata = { title: 'Mes grilles' }

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Le proxy protege deja la route ; cette garde couvre le cas ou la session
  // expire entre le passage du proxy et le rendu.
  if (!user) redirect('/login')

  const [{ data: profile }, grids, plan] = await Promise.all([
    supabase.from('profiles').select('username, display_name').eq('id', user.id).single(),
    listGrids(),
    loadActiveGridPlan(),
  ])

  const name = profile?.display_name ?? profile?.username ?? 'athlete'

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 p-4 pb-16">
      <header className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold">Salut {name}</h1>
          <p className="text-muted-foreground text-sm">
            {profile ? `@${profile.username}` : 'Profil en cours de creation'}
          </p>
        </div>
        <SignOutButton />
      </header>

      {plan ? <NextSession plan={plan} /> : null}

      {grids.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Construis ta premiere grille</CardTitle>
            <CardDescription>
              Pars de la progression de reference — dix niveaux, cinq exercices chacun —
              puis adapte-la. Ou commence d&apos;une page blanche.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <form action={createGridFromTemplate}>
              <Button type="submit">Utiliser la grille de reference</Button>
            </form>
            <NewGrid />
          </CardContent>
        </Card>
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="text-lg font-medium">Mes grilles</h2>
            <ul className="space-y-2">
              {grids.map((grid) => (
                <li key={grid.id}>
                  <Card>
                    <CardContent className="flex items-center justify-between gap-3 py-4">
                      <Link href={`/grilles/${grid.id}`} className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="truncate font-medium">{grid.name}</span>
                          {grid.isActive ? (
                            <span className="bg-muted text-muted-foreground shrink-0 rounded-full px-2 py-0.5 text-xs">
                              active
                            </span>
                          ) : null}
                        </span>
                        <span className="text-muted-foreground block text-xs">
                          {grid.levelCount} niveau{grid.levelCount > 1 ? 'x' : ''}
                          {grid.description ? ` — ${grid.description}` : ''}
                        </span>
                      </Link>

                      {!grid.isActive ? (
                        <form action={activateGrid} className="shrink-0">
                          <input type="hidden" name="gridId" value={grid.id} />
                          <Button type="submit" size="sm" variant="ghost">
                            Activer
                          </Button>
                        </form>
                      ) : null}
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
          </section>

          <div className="flex flex-wrap gap-2">
            <NewGrid />
            <form action={createGridFromTemplate}>
              <Button type="submit" variant="outline">
                Ajouter la grille de reference
              </Button>
            </form>
          </div>
        </>
      )}
    </main>
  )
}

/**
 * Le point d'entree de la seance, mis en avant : c'est l'action qu'on vient
 * chercher en ouvrant l'application en salle.
 */
function NextSession({ plan }: { plan: SessionStart }) {
  if (plan.resumeLevel === null) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Grille terminee</CardTitle>
          <CardDescription>
            Tous les niveaux de « {plan.gridName} » sont valides. Ajoute un niveau, ou
            passe a une autre grille.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const level = plan.resumeLevel
  const setCount = level.exercises.reduce((total, exercise) => total + exercise.sets, 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Niveau {level.position}
          {level.name ? ` — ${level.name}` : ''}
        </CardTitle>
        <CardDescription>
          {plan.gridName} · {level.exercises.length} exercice
          {level.exercises.length > 1 ? 's' : ''}, {setCount} serie
          {setCount > 1 ? 's' : ''} a valider
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Link href="/seance" className={buttonVariants({ size: 'lg' })}>
          Demarrer la seance
        </Link>
      </CardContent>
    </Card>
  )
}
