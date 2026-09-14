import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/server'

import { signIn, signInWithGoogle } from '../actions'
import { AuthForm } from '../auth-form'

export const metadata: Metadata = { title: 'Connexion' }

export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) redirect('/')

  const params = await searchParams
  const redirectTo = typeof params.redirectTo === 'string' ? params.redirectTo : undefined
  const error = typeof params.error === 'string' ? params.error : undefined

  return (
    <section className="bg-card border-border flex flex-col gap-5 rounded-[20px] border p-6">
      <div>
        <h1 className="text-lg font-bold">Connexion</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Reprends ta progression là où tu l&apos;as laissée.
        </p>
      </div>

      <AuthForm
        action={signIn}
        mode="signin"
        redirectTo={redirectTo}
        initialError={error}
      />

      <div className="flex items-center gap-3">
        <span className="bg-border h-px flex-1" />
        <span className="text-tertiary text-xs uppercase">ou</span>
        <span className="bg-border h-px flex-1" />
      </div>

      <form action={signInWithGoogle}>
        <Button type="submit" variant="outline" className="w-full">
          Continuer avec Google
        </Button>
      </form>

      <p className="text-muted-foreground text-sm">
        Pas encore de compte ?{' '}
        <Link href="/signup" className="text-primary font-semibold">
          Créer un compte
        </Link>
      </p>
    </section>
  )
}
