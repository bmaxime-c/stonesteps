'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  buildSetSlots,
  isLevelValidated,
  listFailures,
  nextSlotIndex,
  type PlannedLevel,
  type SetOutcome,
} from '@/lib/session/progress'
import {
  deleteLocalSession,
  findUnfinishedSession,
  saveLocalSession,
  type LocalSession,
} from '@/lib/session/local-store'
import { useWakeLock } from '@/lib/session/use-wake-lock'

import { syncSession } from './actions'
import { SetRunner } from './set-runner'

type SyncState = 'idle' | 'pending' | 'synced' | 'failed'

/**
 * Etat du reseau, lu comme une source externe plutot que recopie dans un
 * useState : c'est le navigateur qui detient la valeur, pas le composant.
 */
function subscribeToNetwork(onChange: () => void): () => void {
  window.addEventListener('online', onChange)
  window.addEventListener('offline', onChange)
  return () => {
    window.removeEventListener('online', onChange)
    window.removeEventListener('offline', onChange)
  }
}

function useOnline(): boolean {
  return useSyncExternalStore(
    subscribeToNetwork,
    () => navigator.onLine,
    // Cote serveur, on suppose le reseau present : l'alerte hors ligne
    // n'apparait alors jamais dans le HTML initial.
    () => true,
  )
}

export function SessionRunner({
  gridId,
  gridName,
  level,
}: {
  gridId: string
  gridName: string
  level: PlannedLevel
}) {
  const router = useRouter()
  const [session, setSession] = useState<LocalSession | null>(null)
  const [syncState, setSyncState] = useState<SyncState>('idle')
  const [syncError, setSyncError] = useState<string | null>(null)
  const online = useOnline()

  const slots = buildSetSlots(level)
  const finished = session?.endedAt !== null && session !== null

  useWakeLock(session !== null && !finished)

  // Reprend la seance interrompue si elle porte sur le meme niveau, sinon en
  // ouvre une neuve. L'identifiant est genere ici : une seance peut ainsi
  // commencer sans reseau.
  useEffect(() => {
    let cancelled = false

    const boot = async () => {
      const unfinished = await findUnfinishedSession().catch(() => undefined)
      if (cancelled) return

      if (unfinished && unfinished.level.id === level.id) {
        setSession(unfinished)
        return
      }

      const fresh: LocalSession = {
        id: crypto.randomUUID(),
        gridId,
        gridName,
        level,
        startedAt: new Date().toISOString(),
        endedAt: null,
        outcomes: [],
        synced: false,
      }
      await saveLocalSession(fresh).catch(() => {})
      if (!cancelled) setSession(fresh)
    }

    void boot()
    return () => {
      cancelled = true
    }
  }, [gridId, gridName, level])

  // La reprise de synchronisation est declenchee par l'evenement reseau, pas
  // par un effet observant l'etat : c'est le retour du reseau qui est le fait
  // declencheur.
  const retryRef = useRef<() => void>(() => {})

  useEffect(() => {
    const onReconnect = () => retryRef.current()
    window.addEventListener('online', onReconnect)
    return () => window.removeEventListener('online', onReconnect)
  }, [])

  const persist = useCallback(async (next: LocalSession) => {
    setSession(next)
    await saveLocalSession(next).catch(() => {})
  }, [])

  const recordOutcome = useCallback(
    (slotIndex: number, partial: Omit<SetOutcome, 'levelExerciseId' | 'setIndex'>) => {
      if (!session) return
      const slot = slots[slotIndex]
      const outcome: SetOutcome = {
        levelExerciseId: slot.levelExerciseId,
        setIndex: slot.setIndex,
        ...partial,
      }
      void persist({ ...session, outcomes: [...session.outcomes, outcome] })
    },
    [session, slots, persist],
  )

  const push = useCallback(async (target: LocalSession) => {
    setSyncState('pending')
    setSyncError(null)

    const result = await syncSession({
      sessionId: target.id,
      gridId: target.gridId,
      levelId: target.level.id,
      startedAt: target.startedAt,
      endedAt: target.endedAt,
      validated: isLevelValidated(target.level, target.outcomes),
      outcomes: target.outcomes,
    }).catch((error: unknown) => ({
      ok: false as const,
      error: error instanceof Error ? error.message : 'Reseau indisponible.',
    }))

    if (result.ok) {
      setSyncState('synced')
      await saveLocalSession({ ...target, synced: true }).catch(() => {})
    } else {
      setSyncState('failed')
      setSyncError(result.error)
    }
  }, [])

  const finish = useCallback(async () => {
    if (!session) return
    const ended: LocalSession = { ...session, endedAt: new Date().toISOString() }
    await persist(ended)
    await push(ended)
  }, [session, persist, push])

  // Ecrire la ref dans un effet, pas pendant le rendu : le rendu doit rester
  // sans effet de bord.
  useEffect(() => {
    retryRef.current = () => {
      if (syncState === 'failed' && session?.endedAt) void push(session)
    }
  }, [syncState, session, push])

  if (!session) {
    return <p className="text-muted-foreground p-4 text-sm">Preparation de la seance…</p>
  }

  const outcomes = session.outcomes
  const currentIndex = nextSlotIndex(slots, outcomes)
  const done = currentIndex === -1
  const validated = isLevelValidated(level, outcomes)
  const failures = listFailures(level, outcomes)

  if (session.endedAt !== null) {
    return (
      <Recap
        session={session}
        validated={validated}
        failureCount={failures.length}
        totalSets={slots.length}
        syncState={syncState}
        syncError={syncError}
        onRetry={() => void push(session)}
        onDiscard={async () => {
          await deleteLocalSession(session.id).catch(() => {})
          router.push('/dashboard')
        }}
      />
    )
  }

  return (
    <div className="space-y-5">
      <header className="space-y-1 text-center">
        <p className="text-muted-foreground text-xs">
          {gridName} — niveau {level.position}
          {level.name ? ` · ${level.name}` : ''}
        </p>
        <Progress done={outcomes.length} total={slots.length} />
      </header>

      {!online ? (
        <Alert>
          <AlertDescription>
            Hors ligne. La seance continue et sera envoyee au retour du reseau.
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardContent className="py-6">
          {done ? (
            <div className="space-y-4 text-center">
              <p className="text-lg font-medium">
                {validated ? 'Niveau valide.' : 'Niveau non valide.'}
              </p>
              <p className="text-muted-foreground text-sm">
                {validated
                  ? 'Toutes les series sont passees. La prochaine seance demarrera au niveau suivant.'
                  : `${failures.length} serie${failures.length > 1 ? 's' : ''} manquee${
                      failures.length > 1 ? 's' : ''
                    }. La prochaine seance repartira de ce niveau.`}
              </p>
              <Button size="lg" className="w-full" onClick={() => void finish()}>
                Terminer la seance
              </Button>
            </div>
          ) : (
            <SetRunner
              key={`${slots[currentIndex].levelExerciseId}-${slots[currentIndex].setIndex}`}
              slot={slots[currentIndex]}
              onRecord={(partial) => recordOutcome(currentIndex, partial)}
            />
          )}
        </CardContent>
      </Card>

      <details className="text-sm">
        <summary className="text-muted-foreground cursor-pointer list-none">
          Voir le detail du niveau
        </summary>
        <ul className="divide-border mt-2 divide-y">
          {slots.map((slot, index) => {
            const outcome = outcomes.find(
              (o) =>
                o.levelExerciseId === slot.levelExerciseId &&
                o.setIndex === slot.setIndex,
            )
            return (
              <li
                key={`${slot.levelExerciseId}-${slot.setIndex}`}
                className="flex items-center justify-between gap-2 py-1.5"
              >
                <span className={index === currentIndex ? 'font-medium' : ''}>
                  {slot.exerciseName} — serie {slot.setIndex}
                </span>
                <span className="text-muted-foreground text-xs">
                  {outcome === undefined
                    ? '—'
                    : outcome.success
                      ? 'reussie'
                      : `manquee${outcome.repsDone !== null ? ` (${outcome.repsDone})` : ''}`}
                </span>
              </li>
            )
          })}
        </ul>
      </details>

      <Button variant="ghost" size="sm" className="w-full" onClick={() => void finish()}>
        Interrompre et enregistrer
      </Button>
    </div>
  )
}

function Progress({ done, total }: { done: number; total: number }) {
  const percent = total === 0 ? 0 : Math.round((done / total) * 100)
  return (
    <div className="space-y-1">
      <div
        className="bg-muted h-1.5 w-full overflow-hidden rounded-full"
        role="progressbar"
        aria-valuenow={done}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label="Progression de la seance"
      >
        <div
          className="bg-foreground h-full transition-all"
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="text-muted-foreground text-xs">
        {done} / {total} series
      </p>
    </div>
  )
}

function Recap({
  session,
  validated,
  failureCount,
  totalSets,
  syncState,
  syncError,
  onRetry,
  onDiscard,
}: {
  session: LocalSession
  validated: boolean
  failureCount: number
  totalSets: number
  syncState: SyncState
  syncError: string | null
  onRetry: () => void
  onDiscard: () => Promise<void>
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{validated ? 'Niveau valide' : 'Seance enregistree'}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-muted-foreground text-sm">
          {session.outcomes.length} / {totalSets} series renseignees, {failureCount}{' '}
          manquee{failureCount > 1 ? 's' : ''}.
        </p>

        {syncState === 'pending' ? (
          <p className="text-muted-foreground text-sm">Envoi en cours…</p>
        ) : null}

        {syncState === 'synced' ? (
          <Alert>
            <AlertDescription>Seance synchronisee.</AlertDescription>
          </Alert>
        ) : null}

        {syncState === 'failed' ? (
          <Alert variant="destructive">
            <AlertDescription>
              Envoi impossible : {syncError ?? 'reseau indisponible'}. La seance reste
              enregistree sur cet appareil et repartira toute seule au retour du reseau.
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {syncState === 'failed' ? (
            <Button size="sm" onClick={onRetry}>
              Reessayer
            </Button>
          ) : null}
          <Link
            href="/dashboard"
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
          >
            Retour au tableau de bord
          </Link>
          {syncState === 'synced' ? (
            <Button size="sm" variant="ghost" onClick={() => void onDiscard()}>
              Effacer la copie locale
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}
