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
import { Input } from '@/components/ui/input'
import { loadFriends, searchProfiles, type PersonSummary } from '@/lib/friends/queries'
import { createClient } from '@/lib/supabase/server'

import {
  acceptFriendRequest,
  blockPerson,
  removeFriendship,
  sendFriendRequest,
} from './actions'

export const metadata: Metadata = { title: 'Amis' }

export default async function FriendsPage({ searchParams }: PageProps<'/amis'>) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const params = await searchParams
  const term = typeof params.q === 'string' ? params.q : ''

  const [overview, results] = await Promise.all([
    loadFriends(),
    term ? searchProfiles(term) : Promise.resolve([]),
  ])

  const knownIds = new Set(
    [
      ...overview.friends,
      ...overview.incoming,
      ...overview.outgoing,
      ...overview.blocked,
    ].map((person) => person.id),
  )

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 p-4 pb-16">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Amis</h1>
        <Link
          href="/dashboard"
          className="text-muted-foreground hover:text-foreground text-sm"
        >
          Tableau de bord
        </Link>
      </header>

      {/* Recherche en GET : le resultat est une URL partageable, et le
          rechargement ne repose pas sur un etat client. */}
      <form action="/amis" method="get" className="flex gap-2">
        <Input
          name="q"
          defaultValue={term}
          placeholder="Chercher un pseudo"
          aria-label="Chercher un membre par pseudo"
          minLength={2}
        />
        <Button type="submit" variant="outline">
          Chercher
        </Button>
      </form>

      {term ? (
        <section className="space-y-2">
          <h2 className="text-lg font-medium">
            {results.length} resultat{results.length > 1 ? 's' : ''} pour « {term} »
          </h2>
          {results.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Aucun membre trouve. Le pseudo doit correspondre exactement, aux majuscules
              pres.
            </p>
          ) : (
            <ul className="space-y-2">
              {results.map((person) => (
                <PersonRow key={person.id} person={person}>
                  {knownIds.has(person.id) ? (
                    <span className="text-muted-foreground text-xs">
                      deja en relation
                    </span>
                  ) : (
                    <SubmitAction
                      action={sendFriendRequest}
                      personId={person.id}
                      label="Ajouter"
                    />
                  )}
                </PersonRow>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {overview.incoming.length > 0 ? (
        <Section
          title="Demandes recues"
          description="Accepter donne acces a ton niveau courant et a ton historique."
        >
          {overview.incoming.map((person) => (
            <PersonRow key={person.id} person={person}>
              <SubmitAction
                action={acceptFriendRequest}
                personId={person.id}
                label="Accepter"
              />
              <SubmitAction
                action={removeFriendship}
                personId={person.id}
                label="Refuser"
                variant="ghost"
              />
            </PersonRow>
          ))}
        </Section>
      ) : null}

      <Section
        title={`${overview.friends.length} ami${overview.friends.length > 1 ? 's' : ''}`}
        description={
          overview.friends.length === 0
            ? 'Cherche un pseudo pour envoyer une premiere demande.'
            : undefined
        }
      >
        {overview.friends.map((person) => (
          <PersonRow key={person.id} person={person} href={`/amis/${person.username}`}>
            <SubmitAction
              action={removeFriendship}
              personId={person.id}
              label="Retirer"
              variant="ghost"
            />
            <SubmitAction
              action={blockPerson}
              personId={person.id}
              label="Bloquer"
              variant="ghost"
            />
          </PersonRow>
        ))}
      </Section>

      {overview.outgoing.length > 0 ? (
        <Section title="Demandes envoyees">
          {overview.outgoing.map((person) => (
            <PersonRow key={person.id} person={person}>
              <SubmitAction
                action={removeFriendship}
                personId={person.id}
                label="Annuler"
                variant="ghost"
              />
            </PersonRow>
          ))}
        </Section>
      ) : null}

      {overview.blocked.length > 0 ? (
        <Section title="Bloques">
          {overview.blocked.map((person) => (
            <PersonRow key={person.id} person={person}>
              <SubmitAction
                action={removeFriendship}
                personId={person.id}
                label="Debloquer"
                variant="ghost"
              />
            </PersonRow>
          ))}
        </Section>
      ) : null}
    </main>
  )
}

function Section({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent>
        <ul className="divide-border divide-y">{children}</ul>
      </CardContent>
    </Card>
  )
}

function PersonRow({
  person,
  href,
  children,
}: {
  person: PersonSummary
  href?: string
  children: React.ReactNode
}) {
  const name = (
    <span className="min-w-0">
      <span className="block truncate text-sm font-medium">
        {person.displayName ?? person.username}
      </span>
      <span className="text-muted-foreground block text-xs">@{person.username}</span>
    </span>
  )

  return (
    <li className="flex items-center justify-between gap-2 py-2">
      {href ? (
        <Link href={href} className="min-w-0 flex-1">
          {name}
        </Link>
      ) : (
        name
      )}
      <span className="flex shrink-0 items-center gap-1">{children}</span>
    </li>
  )
}

function SubmitAction({
  action,
  personId,
  label,
  variant = 'outline',
}: {
  action: (formData: FormData) => Promise<void>
  personId: string
  label: string
  variant?: 'outline' | 'ghost'
}) {
  return (
    <form action={action}>
      <input type="hidden" name="personId" value={personId} />
      <Button type="submit" size="sm" variant={variant}>
        {label}
      </Button>
    </form>
  )
}
