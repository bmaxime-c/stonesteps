import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { listSessionGrids, listSessions } from '@/lib/history/queries'
import { buildProgressPoints, computeStats, formatPercent } from '@/lib/history/stats'
import { createClient } from '@/lib/supabase/server'

import { ProgressChart } from './progress-chart'

export const metadata: Metadata = { title: 'Historique' }

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default async function HistoryPage({ searchParams }: PageProps<'/historique'>) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const params = await searchParams
  const gridFilter = typeof params.grille === 'string' ? params.grille : undefined

  const [sessions, grids] = await Promise.all([
    listSessions(gridFilter),
    listSessionGrids(),
  ])

  const stats = computeStats(sessions)
  const points = buildProgressPoints(sessions)

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 p-4 pb-16">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Historique</h1>
        <Link
          href="/dashboard"
          className="text-muted-foreground hover:text-foreground text-sm"
        >
          Tableau de bord
        </Link>
      </header>

      {sessions.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Aucune seance enregistree</CardTitle>
          </CardHeader>
          <CardContent>
            <Link href="/seance" className={buttonVariants()}>
              Demarrer une seance
            </Link>
          </CardContent>
        </Card>
      ) : (
        <>
          <StatTiles
            sessionCount={stats.sessionCount}
            validatedCount={stats.validatedCount}
            successRate={formatPercent(stats.successRate)}
            sessionsPerWeek={stats.sessionsPerWeek}
            currentStreak={stats.currentStreak}
          />

          {stats.mostBlocking ? (
            <p className="text-muted-foreground text-sm">
              Exercice le plus bloquant :{' '}
              <span className="text-foreground font-medium">
                {stats.mostBlocking.exerciseName}
              </span>{' '}
              — {stats.mostBlocking.failures} serie
              {stats.mostBlocking.failures > 1 ? 's' : ''} manquee
              {stats.mostBlocking.failures > 1 ? 's' : ''}.
            </p>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Niveaux valides dans le temps</CardTitle>
            </CardHeader>
            <CardContent>
              <ProgressChart points={points} />
            </CardContent>
          </Card>

          {/* Filtre au-dessus de la liste, sur une seule ligne. */}
          {grids.length > 1 ? (
            <nav className="flex flex-wrap gap-2" aria-label="Filtrer par grille">
              <FilterLink href="/historique" active={!gridFilter} label="Toutes" />
              {grids.map((grid) => (
                <FilterLink
                  key={grid.id}
                  href={`/historique?grille=${grid.id}`}
                  active={gridFilter === grid.id}
                  label={grid.name}
                />
              ))}
            </nav>
          ) : null}

          <section className="space-y-2">
            <h2 className="text-lg font-medium">
              {sessions.length} seance{sessions.length > 1 ? 's' : ''}
            </h2>
            <ul className="space-y-2">
              {sessions.map((session) => (
                <li key={session.id}>
                  <Link
                    href={`/historique/${session.id}`}
                    className="border-border hover:bg-muted/50 flex items-center justify-between gap-3 rounded-lg border p-3"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">
                        Niveau {session.levelPosition}
                        {session.levelName ? ` — ${session.levelName}` : ''}
                      </span>
                      <span className="text-muted-foreground block text-xs">
                        {formatDateTime(session.startedAt)} · {session.gridName} ·{' '}
                        {session.successfulSets}/{session.totalSets} series
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
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <a
            href="/historique/export"
            download
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
          >
            Exporter mes donnees (JSON)
          </a>
        </>
      )}
    </main>
  )
}

function FilterLink({
  href,
  active,
  label,
}: {
  href: string
  active: boolean
  label: string
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`rounded-full border px-3 py-1 text-xs ${
        active
          ? 'border-foreground bg-foreground text-background'
          : 'border-border text-muted-foreground hover:text-foreground'
      }`}
    >
      {label}
    </Link>
  )
}

/** Rangee de chiffres de tete : des tuiles, pas un graphique. */
function StatTiles({
  sessionCount,
  validatedCount,
  successRate,
  sessionsPerWeek,
  currentStreak,
}: {
  sessionCount: number
  validatedCount: number
  successRate: string
  sessionsPerWeek: number | null
  currentStreak: number
}) {
  const tiles = [
    { label: 'Seances', value: String(sessionCount) },
    { label: 'Niveaux valides', value: String(validatedCount) },
    { label: 'Series reussies', value: successRate },
    {
      label: 'Par semaine',
      value: sessionsPerWeek === null ? '—' : sessionsPerWeek.toLocaleString('fr-FR'),
    },
    { label: 'Jours d affilee', value: String(currentStreak) },
  ]

  return (
    <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {tiles.map((tile) => (
        <div key={tile.label} className="border-border rounded-lg border p-3">
          <dt className="text-muted-foreground text-xs">{tile.label}</dt>
          <dd className="text-2xl font-semibold tabular-nums">{tile.value}</dd>
        </div>
      ))}
    </dl>
  )
}
