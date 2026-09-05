import Link from 'next/link'
import { redirect } from 'next/navigation'

import { buttonVariants } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/server'

export default async function HomePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) redirect('/dashboard')

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 p-6 text-center">
      <div className="space-y-3">
        <h1 className="text-4xl font-semibold tracking-tight">StoneSteps</h1>
        <p className="text-muted-foreground max-w-md text-balance">
          Une grille de niveaux, cinq exercices, aucune concession : on ne monte d&apos;un
          cran que lorsque toutes les series sont validees.
        </p>
      </div>

      {/*
        Ce sont des liens, pas des boutons : on reprend l'habillage de Button
        sans son comportement. Le composant Button de Base UI rendrait ici un
        <a> tout en revendiquant la semantique d'un <button>.
      */}
      <div className="flex gap-3">
        <Link href="/signup" className={buttonVariants({ size: 'lg' })}>
          Commencer
        </Link>
        <Link
          href="/login"
          className={buttonVariants({ variant: 'outline', size: 'lg' })}
        >
          Se connecter
        </Link>
      </div>
    </main>
  )
}
