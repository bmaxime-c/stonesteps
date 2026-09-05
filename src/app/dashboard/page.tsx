import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { createClient } from '@/lib/supabase/server'

import { signOut } from '../(auth)/actions'

export const metadata: Metadata = { title: 'Tableau de bord' }

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Le proxy protege deja la route ; cette garde couvre le cas ou la session
  // expire entre le passage du proxy et le rendu.
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('username, display_name')
    .eq('id', user.id)
    .single()

  const name = profile?.display_name ?? profile?.username ?? 'athlete'

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 p-4">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Salut {name}</h1>
          <p className="text-muted-foreground text-sm">
            {profile ? `@${profile.username}` : 'Profil en cours de creation'}
          </p>
        </div>
        <form action={signOut}>
          <Button type="submit" variant="outline" size="sm">
            Se deconnecter
          </Button>
        </form>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Aucune grille pour l&apos;instant</CardTitle>
          <CardDescription>
            L&apos;editeur de grilles arrive en phase 2. Le socle est en place : compte,
            base de donnees et regles d&apos;acces.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="text-muted-foreground list-disc space-y-1 pl-5 text-sm">
            <li>Phase 2 — construire ses niveaux et ses exercices</li>
            <li>Phase 3 — derouler une seance, chrono compris, hors ligne</li>
            <li>Phase 4 — historique et progression</li>
          </ul>
        </CardContent>
      </Card>
    </main>
  )
}
