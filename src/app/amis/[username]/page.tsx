import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { loadFriendProgress } from '@/lib/friends/queries'
import { buildProgressPoints, formatPercent } from '@/lib/history/stats'
import { createClient } from '@/lib/supabase/server'
import { ProgressChart } from '@/app/historique/progress-chart'

export async function generateMetadata({
  params,
}: PageProps<'/amis/[username]'>): Promise<Metadata> {
  const { username } = await params
  return { title: `@${username}` }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export default async function FriendPage({ params }: PageProps<'/amis/[username]'>) {
  const { username } = await params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const progress = await loadFriendProgress(username)
  if (!progress) notFound()

  const { person, currentLevel, sessions, stats } = progress
  const points = buildProgressPoints(sessions)

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-5 p-4 pb-16">
      <Link href="/amis" className="text-muted-foreground hover:text-foreground text-sm">
        ← Amis
      </Link>

      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">
          {person.displayName ?? person.username}
        </h1>
        <p className="text-muted-foreground text-sm">@{person.username}</p>
      </header>

      {sessions.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Rien a afficher</CardTitle>
            <CardDescription>
              Soit cette personne n&apos;a pas encore enregistre de seance, soit vous
              n&apos;etes pas amis. Dans le second cas, envoie-lui une demande depuis la
              page Amis.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {currentLevel
                  ? `Niveau ${currentLevel.position}${currentLevel.name ? ` — ${currentLevel.name}` : ''}`
                  : 'Aucun niveau valide pour l instant'}
              </CardTitle>
              {currentLevel ? (
                <CardDescription>{currentLevel.gridName}</CardDescription>
              ) : null}
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-3 gap-2 text-sm">
                <Stat label="Seances" value={String(stats.sessionCount)} />
                <Stat label="Niveaux valides" value={String(stats.validatedCount)} />
                <Stat label="Series reussies" value={formatPercent(stats.successRate)} />
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Niveaux valides dans le temps</CardTitle>
            </CardHeader>
            <CardContent>
              <ProgressChart points={points} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Dernieres seances</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="divide-border divide-y text-sm">
                {sessions.slice(0, 15).map((session) => (
                  <li
                    key={session.id}
                    className="flex items-center justify-between gap-3 py-2"
                  >
                    <span className="min-w-0">
                      <span className="block truncate">
                        Niveau {session.levelPosition}
                        {session.levelName ? ` — ${session.levelName}` : ''}
                      </span>
                      <span className="text-muted-foreground block text-xs">
                        {formatDate(session.startedAt)} · {session.successfulSets}/
                        {session.totalSets} series
                      </span>
                    </span>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${
                        session.validated
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {session.validated ? 'valide' : 'non valide'}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </>
      )}
    </main>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="text-xl font-semibold tabular-nums">{value}</dd>
    </div>
  )
}
