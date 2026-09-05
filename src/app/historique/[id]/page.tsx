import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getSession } from '@/lib/history/queries'
import { formatDuration } from '@/lib/session/timer'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Detail de seance' }

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default async function SessionDetailPage({
  params,
}: PageProps<'/historique/[id]'>) {
  const { id } = await params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const session = await getSession(id)
  if (!session) notFound()

  const duration =
    session.endedAt === null
      ? null
      : (Date.parse(session.endedAt) - Date.parse(session.startedAt)) / 1000

  // Regroupe par exercice : on lit une seance exercice par exercice, pas
  // serie par serie melangee.
  const byExercise = new Map<string, typeof session.results>()
  for (const result of session.results) {
    const bucket = byExercise.get(result.exerciseName) ?? []
    bucket.push(result)
    byExercise.set(result.exerciseName, bucket)
  }

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-5 p-4 pb-16">
      <Link
        href="/historique"
        className="text-muted-foreground hover:text-foreground text-sm"
      >
        ← Historique
      </Link>

      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">
          Niveau {session.levelPosition}
          {session.levelName ? ` — ${session.levelName}` : ''}
        </h1>
        <p className="text-muted-foreground text-sm">
          {formatDateTime(session.startedAt)} · {session.gridName}
          {duration !== null ? ` · ${formatDuration(duration)}` : ' · interrompue'}
        </p>
        <p className="text-sm">
          <span
            className={`rounded-full px-2 py-0.5 text-xs ${
              session.validated
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            {session.validated ? 'Niveau valide' : 'Niveau non valide'}
          </span>{' '}
          <span className="text-muted-foreground">
            {session.successfulSets}/{session.totalSets} series reussies
          </span>
        </p>
      </header>

      {byExercise.size === 0 ? (
        <p className="text-muted-foreground text-sm">
          Aucune serie enregistree pour cette seance.
        </p>
      ) : (
        [...byExercise].map(([exerciseName, results]) => (
          <Card key={exerciseName}>
            <CardHeader>
              <CardTitle className="text-base">{exerciseName}</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="divide-border divide-y text-sm">
                {results.map((result) => (
                  <li
                    key={result.setIndex}
                    className="flex items-center justify-between gap-3 py-1.5"
                  >
                    <span className="text-muted-foreground">Serie {result.setIndex}</span>
                    <span className="flex items-center gap-2">
                      {result.durationSeconds !== null ? (
                        <span className="text-muted-foreground text-xs tabular-nums">
                          {formatDuration(result.durationSeconds)}
                        </span>
                      ) : null}
                      {!result.success && result.repsDone !== null ? (
                        <span className="text-muted-foreground text-xs tabular-nums">
                          {result.repsDone} rep.
                        </span>
                      ) : null}
                      <span
                        className={
                          result.success ? 'text-foreground' : 'text-destructive'
                        }
                      >
                        {result.success ? 'reussie' : 'manquee'}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))
      )}
    </main>
  )
}
