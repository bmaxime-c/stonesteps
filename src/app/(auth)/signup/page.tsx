import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'

import { signUp } from '../actions'
import { AuthForm } from '../auth-form'

export const metadata: Metadata = { title: 'Creer un compte' }

export default async function SignUpPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) redirect('/')

  return (
    <section className="bg-card border-border flex flex-col gap-5 rounded-[20px] border p-6">
      <div>
        <h1 className="text-lg font-bold">Creer un compte</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Construis ta grille de niveaux et suis tes seances.
        </p>
      </div>

      <AuthForm action={signUp} mode="signup" />

      <p className="text-muted-foreground text-sm">
        Deja inscrit ?{' '}
        <Link href="/login" className="text-primary font-semibold">
          Se connecter
        </Link>
      </p>
    </section>
  )
}
