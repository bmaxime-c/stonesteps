'use client'

import { useMemo, useState } from 'react'

import { SetRunner } from '@/app/seance/[gridId]/set-runner'
import type { TimerCuePreferences } from '@/lib/account/preferences'
import type { Level } from '@/lib/grids/model'
import type { Room } from '@/lib/session/group/model'
import { buildSteps, progressRatio } from '@/lib/session/steps'
import { useNow } from '@/lib/session/use-now'
import { useTimerCues } from '@/lib/session/use-timer-cues'
import { useWakeLock } from '@/lib/session/use-wake-lock'

/**
 * Coureur d'une seance a plusieurs.
 *
 * Tout le salon joue la meme serie : celle du curseur du salon, dans le niveau
 * choisi au lancement, sur la version figee. Le curseur vit en base et non
 * ici : c'est lui qui fait avancer tout le monde ensemble.
 *
 * Provisoire (phase 1) : valider une serie ne fait que la marquer finie sur
 * cet ecran. La declaration au salon et l'avance synchronisee viennent ensuite.
 */
export function GroupRunner({
  room,
  levels,
  cues,
}: {
  room: Room
  /** Niveaux de la version figee du salon. */
  levels: Level[]
  cues: TimerCuePreferences
}) {
  const level = levels.find((candidate) => candidate.id === room.levelId)
  const steps = useMemo(() => (level ? buildSteps(level) : []), [level])
  const step = steps[room.cursor]

  // Etat local a la serie en cours : il repart a zero quand le curseur bouge.
  const [local, setLocal] = useState<{
    cursor: number
    timerStartedAt: number | null
    done: boolean
  }>({ cursor: room.cursor, timerStartedAt: null, done: false })
  const current =
    local.cursor === room.cursor
      ? local
      : { cursor: room.cursor, timerStartedAt: null, done: false }

  const now = useNow(current.timerStartedAt !== null && !current.done)
  const { emit, blinking } = useTimerCues(cues)
  useWakeLock(true)

  if (!level || !step) return null

  return (
    <main className="mx-auto flex h-[100dvh] w-full max-w-[620px] flex-col overflow-hidden px-[clamp(16px,4vw,32px)] pt-[calc(env(safe-area-inset-top)+clamp(8px,1.5dvh,20px))] pb-[calc(env(safe-area-inset-bottom)+clamp(12px,2dvh,24px))]">
      <header className="flex shrink-0 flex-wrap items-center gap-2.5 pb-[clamp(10px,2dvh,16px)]">
        <span className="bg-success/16 text-success rounded-full px-3 py-[5px] text-[12.5px] font-extrabold whitespace-nowrap">
          Niveau {level.position}/{levels.length}
        </span>
        <span className="text-[13px] font-semibold tracking-[0.04em] whitespace-nowrap text-white/60 uppercase">
          Exercice {step.exerciseNumber}/{step.exerciseCount} · Série {step.setNumber}/
          {step.setCount}
        </span>
      </header>

      <div className="mb-[clamp(14px,3dvh,28px)] h-1 shrink-0 overflow-hidden rounded-sm bg-white/12">
        <div
          className="bg-primary h-full transition-[width] duration-300"
          style={{ width: `${progressRatio(room.cursor, steps.length) * 100}%` }}
        />
      </div>

      <p className="mb-[clamp(6px,1.5dvh,12px)] shrink-0 text-center text-[clamp(20px,3.4dvh,26px)] font-bold tracking-[-0.01em]">
        {step.exerciseName}
      </p>

      {step.exerciseImageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={step.exerciseImageUrl}
          alt={`Illustration : ${step.exerciseName}`}
          className="bg-inset mx-auto mb-[clamp(6px,1.5dvh,12px)] h-[clamp(64px,16dvh,160px)] w-auto max-w-full shrink-0 rounded-[14px] object-contain"
        />
      ) : null}

      {current.done ? (
        <p className="text-muted-foreground flex flex-1 items-center justify-center text-center text-[16px] font-semibold">
          Série terminée. En attente du groupe.
        </p>
      ) : (
        <SetRunner
          step={step}
          timerStartedAt={current.timerStartedAt}
          now={now}
          warningPercent={cues.warningPercent}
          onCue={emit}
          onStartTimer={() => setLocal({ ...current, timerStartedAt: Date.now() })}
          onValidate={() => setLocal({ ...current, done: true })}
        />
      )}

      {blinking ? (
        <div
          aria-hidden="true"
          className="bg-success pointer-events-none fixed inset-0 z-30 opacity-80"
        />
      ) : null}
    </main>
  )
}
