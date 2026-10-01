'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { consolidateSession } from '@/app/seance/[gridId]/actions'
import type { Correction } from '@/app/seance/[gridId]/correction-control'
import { RestScreen } from '@/app/seance/[gridId]/rest-screen'
import { ReviewScreen } from '@/app/seance/[gridId]/review-screen'
import { RunnerHeader } from '@/app/seance/[gridId]/runner-header'
import { SetRunner } from '@/app/seance/[gridId]/set-runner'
import { Summary } from '@/app/seance/[gridId]/summary'
import type { TimerCuePreferences } from '@/lib/account/preferences'
import { type Level, setTarget, setUnit } from '@/lib/grids/model'
import { correctTimedResult, isCorrectable } from '@/lib/session/correction'
import {
  canAdvance,
  fillSkipped,
  restRemaining,
  type RoomStep,
} from '@/lib/session/group/flow'
import type { Room } from '@/lib/session/group/model'
import {
  countedResults,
  memberStatuses,
  pendingDeclaration,
  playedResult,
  playerStage,
  recordResult,
  reviewsBeforeDeclaring,
} from '@/lib/session/group/run'
import {
  clearGroupRun,
  type GroupRun,
  loadGroupRun,
  saveGroupRun,
} from '@/lib/session/group/run-store'
import { isLevelValidated } from '@/lib/session/level'
import type { SetResult, SetStatus } from '@/lib/session/model'
import { setStatus } from '@/lib/session/status'
import { buildSteps, setLabel } from '@/lib/session/steps'
import { startDelay, stopAllTimers, stopDelay } from '@/lib/session/timers'
import { useNow } from '@/lib/session/use-now'
import { useTimerCues } from '@/lib/session/use-timer-cues'
import { useWakeLock, vibrate } from '@/lib/session/use-wake-lock'

import { advanceRoom, declareSet } from '../actions'
import { Finished } from './finished'
import { WaitingScreen } from './waiting-screen'

/**
 * Coureur d'une seance a plusieurs.
 *
 * Tout le salon joue la meme serie : celle du curseur du salon, dans le niveau
 * choisi au lancement, sur la version figee. Le curseur vit en base et non
 * ici : c'est lui qui fait avancer tout le monde ensemble.
 *
 * Chacun garde ses resultats sur son appareil, comme en solo, et ne declare au
 * salon que le statut de sa serie. Une serie chronometree que ne suit aucun
 * repos se corrige d'abord, comme en solo, et ne se declare qu'en quittant
 * l'etape de correction. Une fois declaree, il attend le groupe, en
 * corrigeant encore son chrono s'il le faut. L'hote fait avancer : des que
 * tous les presents ont declare, a la fin du repos commun, ou quand il force.
 * Les series que le groupe a passees sans nous, ou closes avant d'en recevoir
 * la declaration, sont comptees echouees. A la fin, chacun enregistre sa
 * propre seance.
 *
 * Memes ecrans que le solo, composes autrement : en-tete, serie, correction,
 * repos, resume, plus l'ecran d'attente du groupe.
 */
export function GroupRunner({
  room,
  presentIds,
  userId,
  reload,
  grid,
  levels,
  cues,
}: {
  room: Room
  presentIds: ReadonlySet<string>
  userId: string
  /** Relit le salon : apres un appel refuse parce qu'il avait bouge. */
  reload: () => Promise<void>
  /** Version figee du salon : nom, numero et repos. */
  grid: { name: string; version: number; restSeconds: number }
  /** Niveaux de la version figee du salon. */
  levels: Level[]
  cues: TimerCuePreferences
}) {
  const router = useRouter()
  const level = levels.find((candidate) => candidate.id === room.levelId)
  const levelId = level?.id ?? ''
  const steps = useMemo(() => (level ? buildSteps(level) : []), [level])
  const roomId = room.id
  const isHost = room.hostId === userId

  const [run, setRun] = useState<GroupRun | null>(null)
  const [hydrated, setHydrated] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [stepError, setStepError] = useState<string | null>(null)
  const [forcing, setForcing] = useState(false)
  // Declaration de sa serie en route : on attend le groupe, et l'on
  // n'enregistre rien tant que le salon n'a pas tranche.
  const [submitting, setSubmitting] = useState(false)

  // Reprise apres le montage, comme en solo : lire sessionStorage pendant le
  // rendu ferait diverger le HTML du serveur de celui du client.
  //
  // Apres une coupure, rien de plus a faire ici : le salon relu -- au rendu
  // serveur, ou au reabonnement du canal (useRoom) -- porte le curseur du
  // groupe, et fillSkipped compte echouees les series passees sans nous.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRun(loadGroupRun(roomId, levelId) ?? freshRun(roomId, levelId))
    setHydrated(true)
  }, [roomId, levelId])

  useEffect(() => {
    if (hydrated && run) saveGroupRun(run)
  }, [hydrated, run])

  // Point d'arret unique des minuteurs, au demontage.
  useEffect(() => () => stopAllTimers(), [])

  const roomStep: RoomStep = useMemo(
    () => ({ cursor: room.cursor, stage: room.stage }),
    [room.cursor, room.stage],
  )
  const selfDeclared =
    room.members.find((member) => member.userId === userId)?.declaredCursor ?? -1
  const pending = pendingDeclaration(run?.undeclared ?? null, selfDeclared)
  // Ce qu'on a joue et qui compte : une serie que le groupe a close avant
  // d'en recevoir la declaration est echouee, comme pour tout non-declare.
  const played = useMemo(
    () => countedResults(run?.results ?? [], pending, roomStep),
    [pending, roomStep, run],
  )
  // Ce qui part au resume et en base : ce qu'on a joue, plus les series que
  // le groupe a passees sans nous, echouees.
  const results = useMemo(
    () => fillSkipped(played, roomStep, steps),
    [played, roomStep, steps],
  )
  const stage = playerStage(room, played, submitting ? null : pending)
  const step = steps[room.cursor]

  // L'hote compte parmi les presents, que sa propre presence soit deja
  // revenue du canal ou non.
  const present = useMemo(() => new Set([...presentIds, userId]), [presentIds, userId])

  const timerStartedAt =
    stage === 'set' && run?.timer?.cursor === room.cursor ? run.timer.startedAt : null
  const now = useNow(stage === 'rest' || timerStartedAt !== null)
  const { emit, blinking, release } = useTimerCues(cues)
  useWakeLock(stage !== 'summary')

  // Declarations a la file : une correction en rafale doit arriver dans
  // l'ordre, sans quoi un statut perime pourrait ecraser le dernier.
  const declarations = useRef<Promise<void>>(Promise.resolve())
  const declare = useCallback(
    (cursor: number, status: SetStatus, first = false) => {
      if (first) setSubmitting(true)
      declarations.current = declarations.current.then(async () => {
        const outcome = await declareSet(roomId, cursor, status)
        if (first) {
          setSubmitting(false)
          // Acceptee : la serie compte telle que declaree. Refusee, elle
          // reste en attente -- echouee si le groupe l'a passee, a
          // redeclarer sinon.
          if (!outcome.stale && !outcome.error) {
            setRun((current) =>
              current && current.undeclared === cursor
                ? { ...current, undeclared: null }
                : current,
            )
          }
        }
        // Serie deja passee par le groupe : elle est comptee echouee, rien
        // a signaler. On relit pour rattraper le salon.
        if (outcome.stale) {
          await reload()
          return
        }
        setStepError(outcome.error)
      })
    },
    [reload, roomId],
  )

  const advance = useCallback(
    async (expected: RoomStep, force: boolean) => {
      setStepError(null)
      const outcome = await advanceRoom(
        roomId,
        expected.cursor,
        expected.stage,
        [...present],
        force,
      )
      // Le salon a deja avance -- double tap, second onglet : l'etat retenu
      // est en route, on le relit.
      if (outcome.stale) await reload()
      else if (outcome.error) setStepError(outcome.error)
    },
    [present, reload, roomId],
  )

  const validate = useCallback(
    (actualValue: number, completed: boolean) => {
      if (!run || !step || stage !== 'set') return

      const result: SetResult = {
        levelSetId: step.set.id,
        setIndex: step.index,
        exerciseName: step.exerciseName,
        setLabel: setLabel(step),
        unit: setUnit(step.set),
        targetValue: setTarget(step.set),
        actualValue,
        status: setStatus(step.set, { value: actualValue, completed }),
      }
      setRun({
        ...run,
        results: recordResult(run.results, result),
        timer: null,
        undeclared: room.cursor,
      })
      // Sans repos derriere, le dernier a declarer n'aurait pas le temps de
      // corriger : l'hote avance aussitot. On corrige donc d'abord, et la
      // declaration part sur l'etape de correction.
      if (reviewsBeforeDeclaring(step.set, room.cursor, steps.length, grid.restSeconds)) {
        return
      }
      declare(room.cursor, result.status, true)
    },
    [declare, grid.restSeconds, room.cursor, run, stage, step, steps.length],
  )

  // Fin de l'etape de correction : la serie se declare avec son statut
  // corrige. Sert aussi a redeclarer apres un echec d'envoi.
  const endReview = useCallback(() => {
    if (stage !== 'review') return
    const own = playedResult(played, room.cursor)
    if (own) declare(room.cursor, own.status, true)
  }, [declare, played, room.cursor, stage])

  // Correction du chrono de la serie du curseur : avant sa declaration, sur
  // l'etape de correction, ou pendant l'attente et le repos qui la suivent,
  // ou elle se redeclare tant que le groupe ne l'a pas depassee. Une serie
  // passee sans nous ne se corrige pas.
  const ownResult = playedResult(played, room.cursor)
  const correctLast = useCallback(
    (seconds: number) => {
      if (!run || !step || !ownResult || !isCorrectable(step.set)) return
      if (stage !== 'review' && stage !== 'waiting' && stage !== 'rest') return

      const corrected = correctTimedResult(step.set, ownResult, seconds)
      setRun({ ...run, results: recordResult(run.results, corrected) })
      // Avant declaration, la correction reste locale : elle partira avec.
      if (stage !== 'review') declare(room.cursor, corrected.status)
    },
    [declare, ownResult, room.cursor, run, stage, step],
  )

  // Lus par reference dans les minuteurs, pour ne pas reprogrammer un delai a
  // chaque rendu.
  const validateRef = useRef(validate)
  const advanceRef = useRef(advance)
  useEffect(() => {
    validateRef.current = validate
    advanceRef.current = advance
  })

  // Cloture automatique d'une serie 'strict' a l'echeance, comme en solo.
  const strictLimit =
    stage === 'set' && step?.set.timerMode === 'strict' ? setTarget(step.set) : null

  useEffect(() => {
    if (strictLimit === null || timerStartedAt === null) return

    const remainingMs = timerStartedAt + strictLimit * 1000 - Date.now()
    const handle = startDelay(
      () => {
        vibrate([120, 60, 120])
        validateRef.current(strictLimit, false)
      },
      Math.max(0, remainingMs),
    )
    return () => stopDelay(handle)
  }, [strictLimit, timerStartedAt])

  // Chez l'hote : avance des que tous les presents ont declare. Une tentative
  // par etat du salon -- position, declarations, presents -- pour ne pas
  // boucler sur un refus ; un nouvel etat en autorise une nouvelle.
  const attempted = useRef<string | null>(null)
  const ready = isHost && hydrated && canAdvance(room, present)
  const readyKey = ready
    ? JSON.stringify([
        room.cursor,
        room.stage,
        room.members.map((member) => member.declaredCursor),
        [...present].sort(),
      ])
    : null

  useEffect(() => {
    if (readyKey === null || attempted.current === readyKey) return
    attempted.current = readyKey
    void advanceRef.current({ cursor: room.cursor, stage: 'set' }, false)
  }, [readyKey, room.cursor])

  // Chez l'hote : fin du repos commun, comptee depuis l'instant serveur.
  const restStartedAt =
    room.status === 'running' && room.stage === 'rest' ? room.restStartedAt : null

  useEffect(() => {
    if (!isHost || restStartedAt === null) return

    const remainingMs = Date.parse(restStartedAt) + grid.restSeconds * 1000 - Date.now()
    const cursor = room.cursor
    const handle = startDelay(
      () => void advanceRef.current({ cursor, stage: 'rest' }, false),
      Math.max(0, remainingMs),
    )
    return () => stopDelay(handle)
  }, [grid.restSeconds, isHost, restStartedAt, room.cursor])

  const leave = useCallback(() => {
    release()
    stopAllTimers()
    clearGroupRun(roomId)
    router.push('/')
  }, [release, roomId, router])

  // Enregistrement de sa propre seance, une fois le salon termine. Le serveur
  // la controle contre le salon : membre, niveau du salon, plafond.
  const persisting = useRef(false)
  const persist = useCallback(async () => {
    if (!run || !level || persisting.current) return
    persisting.current = true
    setSaving(true)
    setSaveError(null)
    const outcome = await consolidateSession({
      gridId: room.gridId,
      levelId: level.id,
      gridName: grid.name,
      gridVersion: grid.version,
      levelNumber: level.position,
      startedAt: new Date(run.startedAt).toISOString(),
      validated: isLevelValidated(results),
      results,
      roomId,
    })
    persisting.current = false
    setSaving(false)
    if (outcome.error) setSaveError(outcome.error)
    else setRun((current) => (current ? { ...current, saved: true } : current))
  }, [grid.name, grid.version, level, results, room.gridId, roomId, run])

  const mustSave =
    stage === 'summary' &&
    run !== null &&
    run.results.length > 0 &&
    !run.saved &&
    !submitting
  const tried = useRef(false)
  useEffect(() => {
    if (!mustSave || tried.current) return
    tried.current = true
    void persist()
  }, [mustSave, persist])

  if (!hydrated || !run || !level) return null

  if (stage === 'summary') {
    // Rien joue sur cet appareil : pas de seance a enregistrer.
    if (run.results.length === 0) return <Finished gridName={grid.name} />
    return (
      <Summary
        gridName={grid.name}
        levelNumber={level.position}
        validated={isLevelValidated(results)}
        results={results}
        saving={saving}
        saveError={saveError}
        onRetry={() => void persist()}
        onFinish={leave}
      />
    )
  }

  if (!step) return null

  const nextStep = steps[room.cursor + 1]
  const correction: Correction | null =
    (stage === 'review' || stage === 'waiting' || stage === 'rest') &&
    ownResult &&
    step.set.timerMode !== 'none'
      ? {
          mode: step.set.timerMode,
          value: ownResult.actualValue,
          max: step.set.timerMode === 'strict' ? setTarget(step.set) : null,
          status: ownResult.status,
          onChange: correctLast,
        }
      : null
  const shown = stage === 'rest' && nextStep ? nextStep : step

  return (
    <main className="mx-auto flex h-[100dvh] w-full max-w-[620px] flex-col overflow-hidden px-[clamp(16px,4vw,32px)] pt-[calc(env(safe-area-inset-top)+clamp(8px,1.5dvh,20px))] pb-[calc(env(safe-area-inset-bottom)+clamp(12px,2dvh,24px))]">
      <RunnerHeader
        levelNumber={level.position}
        levelCount={levels.length}
        step={step}
        shown={shown}
        done={results.length}
        total={steps.length}
      />

      {stage === 'review' ? (
        <ReviewScreen
          correction={correction}
          continueLabel="Continuer"
          onContinue={endReview}
        />
      ) : stage === 'rest' && nextStep ? (
        <RestScreen
          remaining={restRemaining(grid.restSeconds, room.restStartedAt, now)}
          nextExerciseName={nextStep.exerciseName}
          nextSetLabel={setLabel(nextStep)}
          correction={correction}
          onSkip={
            isHost
              ? () => void advance({ cursor: room.cursor, stage: 'rest' }, false)
              : undefined
          }
        />
      ) : stage === 'waiting' ? (
        <WaitingScreen
          others={memberStatuses(room, presentIds, userId)}
          correction={correction}
          isHost={isHost}
          forcing={forcing}
          onForce={async () => {
            setForcing(true)
            await advance({ cursor: room.cursor, stage: 'set' }, true)
            setForcing(false)
          }}
        />
      ) : (
        <SetRunner
          step={step}
          timerStartedAt={timerStartedAt}
          now={now}
          warningPercent={cues.warningPercent}
          onCue={emit}
          onStartTimer={() =>
            setRun({ ...run, timer: { cursor: room.cursor, startedAt: Date.now() } })
          }
          onValidate={validate}
        />
      )}

      {stepError ? (
        <p
          className="text-fail shrink-0 text-center text-[13px] font-semibold"
          role="alert"
        >
          {stepError}
        </p>
      ) : null}

      {blinking ? (
        <div
          aria-hidden="true"
          className="bg-success pointer-events-none fixed inset-0 z-30 opacity-80"
        />
      ) : null}
    </main>
  )
}

function freshRun(roomId: string, levelId: string): GroupRun {
  return {
    roomId,
    levelId,
    startedAt: Date.now(),
    results: [],
    timer: null,
    undeclared: null,
    saved: false,
  }
}
