import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { createClient } from '@/lib/supabase/server'

import { signUp } from '../actions'
import { AuthForm } from '../auth-form'

export const metadata: Metadata = { title: 'Creer un compte' }

export default async function SignUpPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) redirect('/dashboard')

  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Creer un compte</CardTitle>
          <CardDescription>
            Construis ta grille de niveaux et suis tes seances.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AuthForm action={signUp} mode="signup" />
        </CardContent>
        <CardFooter className="text-muted-foreground text-sm">
          Deja inscrit ?&nbsp;
          <Link href="/login" className="text-foreground underline underline-offset-4">
            Se connecter
          </Link>
        </CardFooter>
      </Card>
    </main>
  )
}
