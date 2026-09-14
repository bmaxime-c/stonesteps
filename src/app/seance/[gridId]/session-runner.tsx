'use client'

import { X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { setTarget, setUnit } from '@/lib/grids/model'
import { isLevelValidated } from '@/lib/session/level'
import { clearRun, loadRun, saveRun, type StoredRun } from '@/lib/session/local-store'
import type { SetResult } from '@/lib/session/model'
import { setStatus } from '@/lib/session/status'
import { progressRatio, setLabel, type SetStep } from '@/lib/session/steps'
import { restView } from '@/lib/session/timer'
import { startDelay, stopAllTimers, stopDelay } from '@/lib/session/timers'
import { useNow } from '@/lib/session/use-now'
import { useWakeLock, vibrate } from '@/lib/session/use-wake-lock'

import { consolidateSession } from './actions'
import { RestScreen } from './rest-screen'
import { SetRunner } from './set-runner'
import { Summary } from './summary'

export type SessionPlan = {
  gridId: string
  gridName: string
  /** Version publiee jouee : la seance la retient en snapshot. */
  gridVersion: number
  restSeconds: number
  levelId: string
  levelNumber: number
  levelCount: number
  steps: SetStep[]
}

/**
 * Orchestration de la seance.
 *
 * La seance se joue entierement cote client : une seule ecriture en base, a la
 * fin. Entre les deux, l'etat vit dans sessionStorage pour survivre a un
 * rafraichissement, et la route porte la grille pour ne pas perdre le contexte.
 */
export function SessionRunner({ plan }: { plan: SessionPlan }) {
  const router = useRouter()
  const { steps, levelId, gridId } = plan

  const [run, setRun] = useState<StoredRun>(() => freshRun(gridId, levelId))
  const [hydrated, setHydrated] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [confirmingExit, setConfirmingExit] = useState(false)

  // La reprise se fait apres le montage : lire sessionStorage pendant le rendu
  // ferait diverger le HTML du serveur de celui du client. C'est bien une
  // synchronisation depuis un systeme externe, d'ou la derogation a la regle.
  useEffect(() => {
    const stored = loadRun(gridId, levelId)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (stored) setRun(stored)
    setHydrated(true)
  }, [gridId, levelId])

  useEffect(() => {
    if (hydrated) saveRun(run)
  }, [hydrated, run])

  // Point d'arret unique des minuteurs : au demontage, quel que soit le chemin
  // de sortie emprunte.
  useEffect(() => () => stopAllTimers(), [])

  const step: SetStep | undefined = steps[run.cursor]
  const timing =
    run.stage === 'rest' || (run.stage === 'set' && run.timerStartedAt !== null)
  const now = useNow(timing)

  useWakeLock(run.stage !== 'summary')

  const leave = useCallback(() => {
    stopAllTimers()
    clearRun(gridId)
    router.push('/')
  }, [gridId, router])

  const persist = useCallback(
    async (results: SetResult[]) => {
      setSaving(true)
      setSaveError(null)
      const outcome = await consolidateSession({
        gridId: plan.gridId,
        levelId: plan.levelId,
        gridName: plan.gridName,
        gridVersion: plan.gridVersion,
        levelNumber: plan.levelNumber,
        startedAt: new Date(run.startedAt).toISOString(),
        validated: isLevelValidated(results),
        results,
      })
      setSaving(false)
      if (outcome.error) setSaveError(outcome.error)
    },
    [plan, run.startedAt],
  )

  const validate = useCallback(
    (actualValue: number, completed: boolean) => {
      const current = steps[run.cursor]
      if (!current || run.stage !== 'set') return

      const result: SetResult = {
        levelSetId: current.set.id,
        setIndex: current.index,
        exerciseName: current.exerciseName,
        setLabel: setLabel(current),
        unit: setUnit(current.set),
        targetValue: setTarget(current.set),
        actualValue,
        status: setStatus(current.set, { value: actualValue, completed }),
      }

      const results = [...run.results, result]
      const isLast = run.cursor === steps.length - 1

      if (isLast) {
        setRun({ ...run, results, stage: 'summary', timerStartedAt: null })
        void persist(results)
        return
      }

      // Pas de repos apres la derniere serie : on passe au resume. Ni quand il
      // est desactive sur la grille.
      if (plan.restSeconds > 0) {
        setRun({
          ...run,
          results,
          stage: 'rest',
          restStartedAt: Date.now(),
          timerStartedAt: null,
        })
        return
      }

      setRun({
        ...run,
        results,
        cursor: run.cursor + 1,
        stage: 'set',
        timerStartedAt: null,
      })
    },
    [persist, plan.restSeconds, run, steps],
  )

  const endRest = useCallback(() => {
    setRun((current) =>
      current.stage === 'rest'
        ? {
            ...current,
            cursor: current.cursor + 1,
            stage: 'set',
            restStartedAt: null,
            timerStartedAt: null,
          }
        : current,
    )
  }, [])

  // `validate` change d'identite a chaque rendu : on le lit par reference dans
  // les minuteurs, sinon le delai serait reprogramme en boucle et ne
  // declencherait jamais.
  const validateRef = useRef(validate)
  useEffect(() => {
    validateRef.current = validate
  })

  // Cloture automatique d'une serie 'strict'. Un delai unique pose a
  // l'echeance, pas une surveillance a chaque tick : le moment est connu des
  // le depart du chrono.
  const strictLimit =
    run.stage === 'set' && step?.set.timerMode === 'strict' ? setTarget(step.set) : null

  useEffect(() => {
    if (strictLimit === null || run.timerStartedAt === null) return

    const remainingMs = run.timerStartedAt + strictLimit * 1000 - Date.now()
    const handle = startDelay(
      () => {
        vibrate([120, 60, 120])
        validateRef.current(strictLimit, false)
      },
      Math.max(0, remainingMs),
    )

    return () => stopDelay(handle)
  }, [run.timerStartedAt, strictLimit])

  // Retour automatique sur la serie suivante a l'expiration du repos.
  useEffect(() => {
    if (run.stage !== 'rest' || run.restStartedAt === null) return

    const remainingMs = run.restStartedAt + plan.restSeconds * 1000 - Date.now()
    const handle = startDelay(endRest, Math.max(0, remainingMs))
    return () => stopDelay(handle)
  }, [endRest, plan.restSeconds, run.restStartedAt, run.stage])

  if (run.stage === 'summary') {
    return (
      <Summary
        gridName={plan.gridName}
        levelNumber={plan.levelNumber}
        validated={isLevelValidated(run.results)}
        results={run.results}
        saving={saving}
        saveError={saveError}
        onRetry={() => void persist(run.results)}
        onFinish={leave}
      />
    )
  }

  if (!step) return null

  const nextStep = steps[run.cursor + 1]
  const rest =
    run.restStartedAt === null
      ? { remaining: plan.restSeconds, done: false }
      : restView(plan.restSeconds, run.restStartedAt, now)

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[620px] flex-col px-[clamp(16px,4vw,32px)] pt-[clamp(12px,2vw,24px)] pb-12">
      <header className="flex items-center justify-between gap-3 py-2 pb-4">
        <div className="flex min-w-0 flex-wrap items-center gap-2.5">
          <span className="bg-success/16 text-success rounded-full px-3 py-[5px] text-[12.5px] font-extrabold whitespace-nowrap">
            Niveau {plan.levelNumber}/{plan.levelCount}
          </span>
          <span className="text-[13px] font-semibold tracking-[0.04em] whitespace-nowrap text-white/60 uppercase">
            Exercice {step.exerciseNumber}/{step.exerciseCount} · Série {step.setNumber}/
            {step.setCount}
          </span>
        </div>

        <button
          type="button"
          aria-label="Quitter la séance"
          onClick={() => setConfirmingExit(true)}
          className="flex size-[34px] shrink-0 items-center justify-center rounded-full bg-white/12"
        >
          <X className="size-3.5" />
        </button>
      </header>

      {/* Progression sur le total de series du niveau, pas sur les exercices. */}
      <div className="mb-7 h-1 overflow-hidden rounded-sm bg-white/12">
        <div
          className="bg-primary h-full transition-[width] duration-300"
          style={{ width: `${progressRatio(run.results.length, steps.length) * 100}%` }}
        />
      </div>

      <p className="mb-3 text-center text-[26px] font-bold tracking-[-0.01em]">
        {run.stage === 'rest' && nextStep ? nextStep.exerciseName : step.exerciseName}
      </p>

      {run.stage === 'rest' && nextStep ? (
        <RestScreen
          remaining={rest.remaining}
          nextExerciseName={nextStep.exerciseName}
          nextSetLabel={setLabel(nextStep)}
          onSkip={endRest}
        />
      ) : (
        <SetRunner
          step={step}
          timerStartedAt={run.timerStartedAt}
          now={now}
          onStartTimer={() => setRun({ ...run, timerStartedAt: Date.now() })}
          onValidate={validate}
        />
      )}

      {confirmingExit ? (
        <ConfirmDialog
          title="Quitter la séance ?"
          description="La progression de cette séance est abandonnée, et le niveau reste à repasser en entier."
          confirmLabel="Quitter"
          cancelLabel="Continuer la séance"
          onCancel={() => setConfirmingExit(false)}
          onConfirm={leave}
        />
      ) : null}
    </main>
  )
}

function freshRun(gridId: string, levelId: string): StoredRun {
  return {
    gridId,
    levelId,
    startedAt: Date.now(),
    cursor: 0,
    results: [],
    stage: 'set',
    restStartedAt: null,
    timerStartedAt: null,
    sessionValidated: null,
  }
}
