'use client'

import { useEffect, useRef, useState } from 'react'

import { STATUS_STROKE, STATUS_TEXT, StatusPill } from '@/components/status-pill'
import type { LevelSet } from '@/lib/grids/model'
import { setTarget } from '@/lib/grids/model'
import type { SetStatus } from '@/lib/session/model'
import { setStatus } from '@/lib/session/status'
import type { SetStep } from '@/lib/session/steps'
import { timerView } from '@/lib/session/timer'
import { vibrate } from '@/lib/session/use-wake-lock'

/**
 * Controle d'une serie.
 *
 * Un seul controle a l'ecran : soit le compteur de repetitions, soit l'anneau
 * de chrono, jamais les deux. C'est ce qui rend l'ecran lisible a bout de bras.
 */

const RING_RADIUS = 96
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS

export function SetRunner({
  step,
  timerStartedAt,
  now,
  onStartTimer,
  onValidate,
}: {
  step: SetStep
  /** Null tant que le chrono n'a pas ete demarre. */
  timerStartedAt: number | null
  now: number
  onStartTimer: () => void
  onValidate: (actualValue: number, completed: boolean) => void
}) {
  if (step.set.timerMode === 'none') {
    return <RepsControl key={step.index} set={step.set} onValidate={onValidate} />
  }

  return (
    <TimedControl
      key={step.index}
      set={step.set}
      timerStartedAt={timerStartedAt}
      now={now}
      onStartTimer={onStartTimer}
      onValidate={onValidate}
    />
  )
}

/**
 * Serie sans chrono.
 *
 * Le compteur demarre a l'objectif, pas a zero : l'hypothese par defaut est
 * que la serie est reussie, et l'utilisateur corrige a la marge. Le statut et
 * la couleur du chiffre changent en direct pendant le reglage — c'est le
 * retour principal, avant meme la pastille.
 */
function RepsControl({
  set,
  onValidate,
}: {
  set: LevelSet
  onValidate: (actualValue: number, completed: boolean) => void
}) {
  const target = setTarget(set)
  const [reps, setReps] = useState(target)
  const status = setStatus(set, { value: reps })

  return (
    <>
      <div className="flex flex-1 flex-col items-center justify-center gap-[26px]">
        <div className="flex items-center gap-[22px]">
          <StepButton
            label="Retirer une repetition"
            onClick={() => setReps((r) => Math.max(0, r - 1))}
          >
            &minus;
          </StepButton>

          <div className="min-w-[120px] text-center">
            <div className={`figure-reps ${STATUS_TEXT[status]}`}>{reps}</div>
            <p className="text-muted-foreground mt-1.5 text-[15px]">
              objectif {target} reps
            </p>
          </div>

          <StepButton
            label="Ajouter une repetition"
            onClick={() => setReps((r) => r + 1)}
          >
            +
          </StepButton>
        </div>

        <StatusPill status={status} />
      </div>

      <button
        type="button"
        onClick={() => onValidate(reps, true)}
        className="bg-primary text-primary-foreground mt-4 w-full rounded-full py-5 text-[19px] font-extrabold shadow-[0_0_34px_rgb(0_255_135/0.4)]"
      >
        Valider la serie
      </button>
    </>
  )
}

/** Pas de reglage : 64 px, la cible tactile d'un ecran qu'on utilise essouffle. */
function StepButton({
  children,
  label,
  onClick,
}: {
  children: React.ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex size-16 shrink-0 items-center justify-center rounded-full bg-white/12 text-[34px] leading-none select-none"
    >
      {children}
    </button>
  )
}

/**
 * Serie chronometree.
 *
 * 'minimal' : le chrono monte, l'anneau se remplit, le statut evolue en direct.
 * 'strict'  : compte a rebours, statut neutre pendant l'effort — le verdict ne
 *             tombe qu'a la validation, sans quoi l'utilisateur s'arreterait
 *             des qu'il passe au vert.
 *
 * La valeur est posee en HTML au centre de l'anneau, jamais en <text> SVG :
 * elle doit suivre la typographie de l'app et rester lisible au zoom.
 */
function TimedControl({
  set,
  timerStartedAt,
  now,
  onStartTimer,
  onValidate,
}: {
  set: LevelSet
  timerStartedAt: number | null
  now: number
  onStartTimer: () => void
  onValidate: (actualValue: number, completed: boolean) => void
}) {
  const target = setTarget(set)
  const view = timerStartedAt === null ? null : timerView(set, timerStartedAt, now)

  const display = view ? view.display : set.timerMode === 'strict' ? target : 0
  const progress = view ? view.progress : 0
  // Avant le depart, une serie 'minimal' est a zero seconde tenue, donc
  // echouee ; une serie 'strict' n'a pas encore de verdict.
  const status: SetStatus | null = view
    ? view.liveStatus
    : set.timerMode === 'minimal'
      ? 'fail'
      : null

  // Un seul retour haptique par serie, au moment ou la cible est atteinte en
  // 'minimal'. En 'strict', c'est l'expiration qui vibre, et elle est geree
  // par l'orchestrateur qui cloture la serie.
  const buzzed = useRef(false)
  const elapsed = view?.elapsed ?? 0
  useEffect(() => {
    if (set.timerMode !== 'minimal' || buzzed.current) return
    if (elapsed >= target) {
      buzzed.current = true
      vibrate(80)
    }
  }, [set.timerMode, target, elapsed])

  const strokeKey = status ?? 'progress'

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-[22px]">
      <div className="relative size-[220px]">
        <svg width="220" height="220" viewBox="0 0 220 220" aria-hidden="true">
          <circle
            cx="110"
            cy="110"
            r={RING_RADIUS}
            fill="none"
            stroke="rgb(255 255 255 / 0.12)"
            strokeWidth="14"
          />
          <circle
            cx="110"
            cy="110"
            r={RING_RADIUS}
            fill="none"
            stroke={STATUS_STROKE[strokeKey]}
            strokeWidth="14"
            strokeLinecap="round"
            strokeDasharray={RING_CIRCUMFERENCE}
            strokeDashoffset={RING_CIRCUMFERENCE * (1 - progress)}
            transform="rotate(-90 110 110)"
          />
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 px-7 text-center">
          <div className="figure-timer">{display}s</div>
          <p className="text-muted-foreground text-[13px]">
            {set.timerMode === 'minimal'
              ? `tenir ${target}s min`
              : `${set.targetReps} reps en ${target}s max`}
          </p>
        </div>
      </div>

      <StatusPill status={status} />

      {view ? (
        <button
          type="button"
          onClick={() => onValidate(view.elapsed, true)}
          className="bg-primary text-primary-foreground w-full max-w-[280px] rounded-full py-[18px] text-lg font-extrabold"
        >
          Termine
        </button>
      ) : (
        <button
          type="button"
          onClick={onStartTimer}
          className="bg-primary text-primary-foreground w-full max-w-[280px] rounded-full py-[18px] text-lg font-extrabold shadow-[0_0_30px_rgb(0_255_135/0.4)]"
        >
          Demarrer le chrono
        </button>
      )}
    </div>
  )
}
