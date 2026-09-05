import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { createClient } from '@/lib/supabase/server'

import { signIn, signInWithGoogle } from '../actions'
import { AuthForm } from '../auth-form'

export const metadata: Metadata = { title: 'Connexion' }

export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) redirect('/dashboard')

  const params = await searchParams
  const redirectTo = typeof params.redirectTo === 'string' ? params.redirectTo : undefined
  const error = typeof params.error === 'string' ? params.error : undefined

  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Connexion</CardTitle>
          <CardDescription>
            Reprends ta progression la ou tu l&apos;as laissee.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <AuthForm
            action={signIn}
            mode="signin"
            redirectTo={redirectTo}
            initialError={error}
          />

          <div className="flex items-center gap-3">
            <span className="bg-border h-px flex-1" />
            <span className="text-muted-foreground text-xs uppercase">ou</span>
            <span className="bg-border h-px flex-1" />
          </div>

          <form action={signInWithGoogle}>
            <Button type="submit" variant="outline" className="w-full">
              Continuer avec Google
            </Button>
          </form>
        </CardContent>
        <CardFooter className="text-muted-foreground text-sm">
          Pas encore de compte ?&nbsp;
          <Link href="/signup" className="text-foreground underline underline-offset-4">
            Creer un compte
          </Link>
        </CardFooter>
      </Card>
    </main>
  )
}
