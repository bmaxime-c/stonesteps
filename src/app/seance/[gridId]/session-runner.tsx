'use client'

import { X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'

import { ConfirmDialog } from '@/components/confirm-dialog'
import type { TimerCuePreferences } from '@/lib/account/preferences'
import { setTarget, setUnit } from '@/lib/grids/model'
import { correctTimedResult, isCorrectable } from '@/lib/session/correction'
import { isLevelValidated } from '@/lib/session/level'
import { clearRun, loadRun, saveRun, type StoredRun } from '@/lib/session/local-store'
import type { SetResult } from '@/lib/session/model'
import { setStatus } from '@/lib/session/status'
import { progressRatio, setLabel, type SetStep } from '@/lib/session/steps'
import { restView } from '@/lib/session/timer'
import { startDelay, stopAllTimers, stopDelay } from '@/lib/session/timers'
import { useNow } from '@/lib/session/use-now'
import { useTimerCues } from '@/lib/session/use-timer-cues'
import { useWakeLock, vibrate } from '@/lib/session/use-wake-lock'

import { consolidateSession } from './actions'
import { RestScreen } from './rest-screen'
import { ReviewScreen } from './review-screen'
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
export function SessionRunner({
  plan,
  cues,
}: {
  plan: SessionPlan
  cues: TimerCuePreferences
}) {
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

  const { emit, blinking, release } = useTimerCues(cues)

  useWakeLock(run.stage !== 'summary')

  const leave = useCallback(() => {
    release()
    stopAllTimers()
    clearRun(gridId)
    router.push('/')
  }, [gridId, release, router])

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
      const hasRest = !isLast && plan.restSeconds > 0

      // Une serie chronometree se rectifie avant de repartir : pendant le
      // repos s'il y en a un, sinon sur une etape dediee.
      if (!hasRest && isCorrectable(current.set)) {
        setRun({ ...run, results, stage: 'review', timerStartedAt: null })
        return
      }

      setRun(advance({ ...run, results }, isLast, hasRest))
      if (isLast) void persist(results)
    },
    [persist, plan.restSeconds, run, steps],
  )

  const endReview = useCallback(() => {
    if (run.stage !== 'review') return
    const isLast = run.cursor === steps.length - 1
    setRun(advance(run, isLast, false))
    if (isLast) void persist(run.results)
  }, [persist, run, steps.length])

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

  // Le repos, ou a defaut l'etape de correction, est le moment ou l'on
  // rectifie la serie chronometree qui vient de finir : le resultat est deja
  // range, on le recalcule sur place. Il se fige des qu'on repart.
  const correctLast = useCallback(
    (seconds: number) => {
      setRun((current) => {
        const finished = steps[current.cursor]
        const last = current.results[current.results.length - 1]
        if (current.stage !== 'rest' && current.stage !== 'review') return current
        if (!finished || !last) return current
        if (!isCorrectable(finished.set)) return current

        const corrected = correctTimedResult(finished.set, last, seconds)
        return { ...current, results: [...current.results.slice(0, -1), corrected] }
      })
    },
    [steps],
  )

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
  const lastResult = run.results[run.results.length - 1]
  const correction =
    (run.stage === 'rest' || run.stage === 'review') &&
    lastResult &&
    step.set.timerMode !== 'none'
      ? {
          mode: step.set.timerMode,
          value: lastResult.actualValue,
          max: step.set.timerMode === 'strict' ? setTarget(step.set) : null,
          status: lastResult.status,
          onChange: correctLast,
        }
      : null
  const rest =
    run.restStartedAt === null
      ? { remaining: plan.restSeconds, done: false }
      : restView(plan.restSeconds, run.restStartedAt, now)

  // Mode plein ecran : la seance tient dans la fenetre, sans defilement. On
  // mesure en dvh et non en vh, sinon la barre d'URL mobile retranche une
  // bande qu'on ne verrait jamais.
  return (
    <main className="mx-auto flex h-[100dvh] w-full max-w-[620px] flex-col overflow-hidden px-[clamp(16px,4vw,32px)] pt-[calc(env(safe-area-inset-top)+clamp(8px,1.5dvh,20px))] pb-[calc(env(safe-area-inset-bottom)+clamp(12px,2dvh,24px))]">
      <header className="flex shrink-0 items-center justify-between gap-3 pb-[clamp(10px,2dvh,16px)]">
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
      <div className="mb-[clamp(14px,3dvh,28px)] h-1 shrink-0 overflow-hidden rounded-sm bg-white/12">
        <div
          className="bg-primary h-full transition-[width] duration-300"
          style={{ width: `${progressRatio(run.results.length, steps.length) * 100}%` }}
        />
      </div>

      <p className="mb-[clamp(6px,1.5dvh,12px)] shrink-0 text-center text-[clamp(20px,3.4dvh,26px)] font-bold tracking-[-0.01em]">
        {run.stage === 'rest' && nextStep ? nextStep.exerciseName : step.exerciseName}
      </p>

      {run.stage === 'review' && correction ? (
        <ReviewScreen
          correction={correction}
          continueLabel={nextStep ? 'Série suivante' : 'Voir le résumé'}
          onContinue={endReview}
        />
      ) : run.stage === 'rest' && nextStep ? (
        <RestScreen
          remaining={rest.remaining}
          nextExerciseName={nextStep.exerciseName}
          nextSetLabel={setLabel(nextStep)}
          correction={correction}
          onSkip={endRest}
        />
      ) : (
        <SetRunner
          step={step}
          timerStartedAt={run.timerStartedAt}
          now={now}
          warningPercent={cues.warningPercent}
          onCue={emit}
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

      {/* Clignotement plein ecran : c'est le repere qu'on attrape du coin de
          l'oeil, telephone pose a un metre. Il ne capte aucun evenement, pour
          ne pas avaler un tap au moment ou il passe. */}
      {blinking ? (
        <div
          aria-hidden="true"
          className="bg-success pointer-events-none fixed inset-0 z-30 opacity-80"
        />
      ) : null}
    </main>
  )
}

/**
 * Etape qui suit une serie close : le resume apres la derniere, le repos s'il
 * y en a un, sinon directement la serie suivante.
 */
function advance(run: StoredRun, isLast: boolean, hasRest: boolean): StoredRun {
  const base = { ...run, timerStartedAt: null }
  if (isLast) return { ...base, stage: 'summary' }
  if (hasRest) return { ...base, stage: 'rest', restStartedAt: Date.now() }
  return { ...base, cursor: run.cursor + 1, stage: 'set' }
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
