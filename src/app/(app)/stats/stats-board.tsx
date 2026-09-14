'use client'

import { useMemo, useState } from 'react'

import { shortDate } from '@/lib/grids/describe'
import type { SessionRecord, SetStatus } from '@/lib/session/model'
import { barHeight, chartScale, linePath, stepPath, type Point } from '@/lib/stats/chart'
import {
  exerciseNames,
  exerciseProgress,
  gridNames,
  kpis,
  levelAttempts,
  levelProgress,
  regularity,
  statusDistribution,
} from '@/lib/stats/aggregate'
import { cn } from '@/lib/utils'

/**
 * Tableau de bord des statistiques.
 *
 * Tout est calcule a partir des seances consolidees, par les agregations de
 * `lib/stats/aggregate` — les memes regles de statut qu'a l'ecran de seance,
 * pour que le resume et les chiffres ne se contredisent jamais.
 */

type Mode = 'exercise' | 'grid'

const STATUS_COLOR: Record<SetStatus, string> = {
  success: 'var(--success)',
  surpass: 'var(--surpass)',
  fail: 'var(--fail)',
}

export function StatsBoard({
  sessions,
  today,
}: {
  sessions: SessionRecord[]
  /** Injecte par le serveur : le rendu ne lit pas l'horloge du navigateur. */
  today: string
}) {
  const grids = useMemo(() => gridNames(sessions), [sessions])
  const exercises = useMemo(() => exerciseNames(sessions), [sessions])

  const [mode, setMode] = useState<Mode>('exercise')
  const [gridName, setGridName] = useState(() => grids[0] ?? '')
  const [exerciseName, setExerciseName] = useState(() => exercises[0] ?? '')

  const totals = useMemo(() => kpis(sessions), [sessions])
  const distribution = useMemo(() => statusDistribution(sessions), [sessions])
  const days = useMemo(() => regularity(sessions, new Date(today)), [sessions, today])
  const attempts = useMemo(() => levelAttempts(sessions, gridName), [sessions, gridName])

  return (
    <main className="gutter mx-auto flex w-full max-w-[1040px] flex-col gap-5 pt-[clamp(20px,3vw,36px)] pb-[72px]">
      <h1 className="title-screen">Statistiques</h1>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(160px,100%),1fr))] gap-3">
        <Kpi label="Séances" value={String(totals.sessionCount)} />
        <Kpi
          label="Niveaux validés"
          value={String(totals.validatedLevels)}
          className="text-success"
        />
        <Kpi label="Reps cumulées" value={String(totals.totalReps)} />
        <Kpi
          label="Taux de réussite"
          value={`${Math.round(totals.successRate * 100)}%`}
        />
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(320px,100%),1fr))] items-start gap-4">
        <Card>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2.5">
            <h2 className="text-[15px] font-bold">Progression</h2>
            <div className="bg-inset flex gap-1 rounded-full p-[3px]">
              <ModeChip active={mode === 'exercise'} onClick={() => setMode('exercise')}>
                Par exercice
              </ModeChip>
              <ModeChip active={mode === 'grid'} onClick={() => setMode('grid')}>
                Par grille
              </ModeChip>
            </div>
          </div>

          <div className="mb-3.5 flex flex-wrap gap-2">
            {(mode === 'exercise' ? exercises : grids).map((name) => (
              <FilterChip
                key={name}
                active={name === (mode === 'exercise' ? exerciseName : gridName)}
                onClick={() =>
                  mode === 'exercise' ? setExerciseName(name) : setGridName(name)
                }
              >
                {name}
              </FilterChip>
            ))}
          </div>

          {mode === 'exercise' ? (
            <ExerciseChart sessions={sessions} exerciseName={exerciseName} />
          ) : (
            <GridChart sessions={sessions} gridName={gridName} />
          )}
        </Card>

        <Card>
          <h2 className="text-[15px] font-bold">
            Niveaux — {gridName || 'aucune grille'}
          </h2>
          <p className="text-tertiary mt-1 mb-3.5 text-xs">
            Tentatives et date de validation, niveau par niveau
          </p>

          {attempts.length === 0 ? (
            <p className="text-tertiary text-[13px]">Aucune séance sur cette grille.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {attempts.map((row) => (
                <div key={row.levelNumber} className="flex items-center gap-2.5">
                  <span className="text-muted-foreground min-w-[62px] text-xs font-bold">
                    Niveau {row.levelNumber}
                  </span>
                  <div className="bg-inset h-2.5 flex-1 overflow-hidden rounded-full">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${barHeight(row.attempts, Math.max(...attempts.map((a) => a.attempts)), 100)}%`,
                        background: row.validatedAt ? 'var(--success)' : 'var(--live)',
                      }}
                    />
                  </div>
                  <span className="text-tertiary min-w-[132px] text-right text-[11.5px]">
                    {row.attempts} tentative{row.attempts > 1 ? 's' : ''} ·{' '}
                    {row.validatedAt
                      ? `validé le ${shortDate(row.validatedAt)}`
                      : 'en cours'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <h2 className="mb-3.5 text-[15px] font-bold">Réussite / dépassement / échec</h2>
          <Distribution distribution={distribution} />
        </Card>

        <Card>
          <h2 className="mb-3.5 text-[15px] font-bold">
            Régularité (5 dernières semaines)
          </h2>
          <div className="grid grid-cols-7 gap-1.5">
            {days.map((day) => (
              <div
                key={day.day}
                title={day.day}
                className={cn(
                  'aspect-square rounded-md',
                  day.active ? 'bg-success' : 'bg-inset',
                )}
              />
            ))}
          </div>
        </Card>
      </div>
    </main>
  )
}

/**
 * Progression d'un exercice : effectue contre objectif.
 *
 * Le trait plein est ce qui a ete fait, le pointille l'objectif. Les deux
 * partagent la meme echelle, sans quoi la comparaison n'aurait pas de sens.
 */
function ExerciseChart({
  sessions,
  exerciseName,
}: {
  sessions: SessionRecord[]
  exerciseName: string
}) {
  const points = exerciseProgress(sessions, exerciseName)
  if (points.length === 0) {
    return <p className="text-tertiary text-[13px]">Aucune donnée pour cet exercice.</p>
  }

  const scale = chartScale(
    points.flatMap((point) => [point.actual, point.target]),
    points.length,
  )
  const actual: Point[] = points.map((point, index) => ({
    x: scale.x(index),
    y: scale.y(point.actual),
  }))
  const target: Point[] = points.map((point, index) => ({
    x: scale.x(index),
    y: scale.y(point.target),
  }))
  const unit = points[0].unit === 's' ? 'secondes' : 'répétitions'

  return (
    <>
      <svg
        viewBox={scale.viewBox}
        width="100%"
        height="130"
        role="img"
        aria-label={`Progression de ${exerciseName} sur ${points.length} séances`}
      >
        <path
          d={linePath(target)}
          fill="none"
          stroke="var(--border-strong)"
          strokeWidth="2"
          strokeDasharray="4 4"
        />
        <path d={linePath(actual)} fill="none" stroke="var(--success)" strokeWidth="3" />
        {points.map((point, index) => (
          <circle
            key={point.startedAt}
            cx={actual[index].x}
            cy={actual[index].y}
            r="4.5"
            fill={STATUS_COLOR[point.status]}
          />
        ))}
      </svg>
      <p className="text-tertiary mt-1.5 text-xs">
        {exerciseName} · {unit} effectuées contre objectif, une séance par point
      </p>
    </>
  )
}

/**
 * Progression d'une grille : le niveau atteint au fil des seances.
 *
 * Courbe en escalier, et un point par seance colore selon son verdict : c'est
 * la ou l'on voit combien de tentatives a coute chaque cran.
 */
function GridChart({
  sessions,
  gridName,
}: {
  sessions: SessionRecord[]
  gridName: string
}) {
  const points = levelProgress(sessions, gridName)
  if (points.length === 0) {
    return <p className="text-tertiary text-[13px]">Aucune donnée pour cette grille.</p>
  }

  const scale = chartScale(
    points.map((point) => point.levelNumber),
    points.length,
  )
  const coords: Point[] = points.map((point, index) => ({
    x: scale.x(index),
    y: scale.y(point.levelNumber),
  }))

  return (
    <>
      <svg
        viewBox={scale.viewBox}
        width="100%"
        height="130"
        role="img"
        aria-label={`Niveau atteint sur ${gridName}, ${points.length} séances`}
      >
        <path d={stepPath(coords)} fill="none" stroke="var(--success)" strokeWidth="3" />
        {points.map((point, index) => (
          <circle
            key={point.startedAt}
            cx={coords[index].x}
            cy={coords[index].y}
            r="4.5"
            fill={point.validated ? 'var(--success)' : 'var(--fail)'}
          />
        ))}
      </svg>
      <p className="text-tertiary mt-1.5 text-xs">
        {gridName} · niveau tenté à chaque séance, vert si validé
      </p>
    </>
  )
}

function Distribution({ distribution }: { distribution: Record<SetStatus, number> }) {
  const bars: { label: string; status: SetStatus }[] = [
    { label: 'Réussies', status: 'success' },
    { label: 'Dépassées', status: 'surpass' },
    { label: 'Échouées', status: 'fail' },
  ]
  const max = Math.max(...bars.map((bar) => distribution[bar.status]))

  return (
    <div className="flex h-[120px] items-end gap-5">
      {bars.map((bar) => (
        <div
          key={bar.status}
          className="flex h-full flex-1 flex-col items-center justify-end gap-1.5"
        >
          <span className="text-xs font-bold">{distribution[bar.status]}</span>
          <div
            className="w-full max-w-[44px] rounded-t-lg"
            style={{
              height: `${barHeight(distribution[bar.status], max, 90)}px`,
              background: STATUS_COLOR[bar.status],
            }}
          />
          <span className="text-tertiary text-[11px]">{bar.label}</span>
        </div>
      ))}
    </div>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <section className="bg-card border-border rounded-[20px] border p-[18px]">
      {children}
    </section>
  )
}

function Kpi({
  label,
  value,
  className,
}: {
  label: string
  value: string
  className?: string
}) {
  return (
    <div className="bg-card border-border rounded-[16px] border p-4">
      <p className="text-tertiary text-xs font-semibold">{label}</p>
      <p className={cn('mt-1 text-[26px] font-extrabold', className)}>{value}</p>
    </div>
  )
}

function ModeChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'rounded-full px-3 py-1.5 text-xs font-bold whitespace-nowrap',
        active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground',
      )}
    >
      {children}
    </button>
  )
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'rounded-full px-3 py-[7px] text-[12.5px] font-semibold whitespace-nowrap',
        active ? 'bg-success text-ink-neon' : 'bg-chip text-muted-foreground',
      )}
    >
      {children}
    </button>
  )
}
