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
import { listDiscoverableGrids } from '@/lib/friends/queries'
import { createClient } from '@/lib/supabase/server'

import { duplicateGrid } from '../actions'

export const metadata: Metadata = { title: 'Decouvrir des grilles' }

export default async function DiscoverPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Aucun filtre sur la visibilite ici : la RLS ne renvoie que les grilles
  // publiques, celles partagees avec le membre, et celles de ses amis.
  // Refaire le tri en TypeScript creerait une seconde regle a maintenir.
  const grids = await listDiscoverableGrids()

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-5 p-4 pb-16">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Decouvrir</h1>
        <Link
          href="/dashboard"
          className="text-muted-foreground hover:text-foreground text-sm"
        >
          Tableau de bord
        </Link>
      </header>

      {grids.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Rien a decouvrir pour l&apos;instant
            </CardTitle>
            <CardDescription>
              Les grilles publiques, celles partagees avec toi et celles de tes amis
              apparaitront ici.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <ul className="space-y-2">
          {grids.map((grid) => (
            <li key={grid.id}>
              <Card>
                <CardContent className="flex items-center justify-between gap-3 py-4">
                  <Link href={`/grilles/${grid.id}`} className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{grid.name}</span>
                    <span className="text-muted-foreground block text-xs">
                      @{grid.ownerName}
                      {grid.description ? ` — ${grid.description}` : ''}
                    </span>
                  </Link>
                  <form action={duplicateGrid} className="shrink-0">
                    <input type="hidden" name="gridId" value={grid.id} />
                    <Button type="submit" size="sm" variant="outline">
                      Dupliquer
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
