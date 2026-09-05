import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { buttonVariants } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { loadActiveGridPlan } from '@/lib/session/queries'
import { createClient } from '@/lib/supabase/server'

import { SessionRunner } from './session-runner'

export const metadata: Metadata = { title: 'Seance' }

export default async function SessionPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const plan = await loadActiveGridPlan()

  if (!plan) {
    return (
      <Empty
        title="Aucune grille active"
        description="Choisis la grille sur laquelle tu veux progresser depuis le tableau de bord."
      />
    )
  }

  if (plan.resumeLevel === null) {
    return (
      <Empty
        title="Grille terminee"
        description={`Tous les niveaux de « ${plan.gridName} » sont valides. Ajoute un niveau, ou passe a une autre grille.`}
      />
    )
  }

  if (plan.resumeLevel.exercises.length === 0) {
    return (
      <Empty
        title="Niveau vide"
        description={`Le niveau ${plan.resumeLevel.position} ne contient aucun exercice : il n'y a rien a valider. Complete-le dans l'editeur.`}
        href={`/grilles/${plan.gridId}`}
        linkLabel="Ouvrir l'editeur"
      />
    )
  }

  return (
    <main className="mx-auto w-full max-w-lg flex-1 p-4 pb-16">
      <SessionRunner
        gridId={plan.gridId}
        gridName={plan.gridName}
        level={plan.resumeLevel}
      />
    </main>
  )
}

function Empty({
  title,
  description,
  href = '/dashboard',
  linkLabel = 'Retour au tableau de bord',
}: {
  title: string
  description: string
  href?: string
  linkLabel?: string
}) {
  return (
    <main className="mx-auto w-full max-w-lg flex-1 p-4">
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <Link href={href} className={buttonVariants({ variant: 'outline' })}>
            {linkLabel}
          </Link>
        </CardContent>
      </Card>
    </main>
  )
}
