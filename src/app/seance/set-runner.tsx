'use client'

import { useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { SetOutcome, SetSlot } from '@/lib/session/progress'
import {
  displaySeconds,
  evaluateTimedSet,
  formatDuration,
  isTimerComplete,
  timerUrgency,
} from '@/lib/session/timer'
import { TIMER_MODE_LABELS } from '@/lib/grids/validation'

/**
 * Une serie : l'affichage de la consigne, le chrono si l'exercice en a un, et
 * la saisie du resultat.
 */
export function SetRunner({
  slot,
  onRecord,
}: {
  slot: SetSlot
  onRecord: (outcome: Omit<SetOutcome, 'levelExerciseId' | 'setIndex'>) => void
}) {
  const timed = slot.timerMode !== 'none' && slot.timerSeconds !== null
  const target = slot.timerSeconds ?? 0

  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [failing, setFailing] = useState(false)
  const repsInput = useRef<HTMLInputElement>(null)

  // Le chrono se cale sur l'horloge, pas sur un compteur d'intervalles : un
  // onglet en arriere-plan ralentit les timers, et une serie de gainage
  // durerait alors plus longtemps que la realite.
  useEffect(() => {
    if (startedAt === null) return
    const id = window.setInterval(() => {
      setElapsed((Date.now() - startedAt) / 1000)
    }, 200)
    return () => window.clearInterval(id)
  }, [startedAt])

  // En mode minimal, on annonce l'objectif atteint sans arreter le chrono :
  // tenir plus longtemps reste une reussite.
  const reached =
    timed && isTimerComplete(slot.timerMode as 'minimal' | 'strict', target, elapsed)

  const shown = timed ? displaySeconds(target, elapsed) : 0

  // Chrono strict : la couleur previent d'un budget qui se vide. Vert tant
  // qu'au plus 85 % du temps est consomme, puis interpolation continue de
  // l'orange vers le rouge jusqu'a l'echeance.
  const urgency = timed && slot.timerMode === 'strict' ? timerUrgency(target, elapsed) : 0

  const timerColor =
    slot.timerMode === 'strict'
      ? urgency === 0
        ? 'var(--primary)'
        : `color-mix(in oklab, var(--status-warning), var(--destructive) ${Math.round(urgency * 100)}%)`
      : reached
        ? 'var(--primary)'
        : 'var(--foreground)'

  const reset = () => {
    setStartedAt(null)
    setElapsed(0)
    setFailing(false)
  }

  const recordTimed = () => {
    const seconds = elapsed
    const verdict = evaluateTimedSet(
      slot.timerMode as 'minimal' | 'strict',
      target,
      seconds,
    )
    onRecord({
      success: verdict.success,
      repsDone: verdict.success ? slot.reps : readReps(),
      durationSeconds: Math.round(seconds * 100) / 100,
    })
    reset()
  }

  const readReps = (): number | null => {
    const raw = repsInput.current?.value?.trim()
    if (!raw) return null
    const value = Number(raw)
    return Number.isFinite(value) && value >= 0 ? Math.floor(value) : null
  }

  return (
    <div className="space-y-5">
      <div className="text-center">
        <p className="text-muted-foreground text-xs tracking-wide uppercase">
          Serie {slot.setIndex} sur {slot.setCount}
        </p>
        <h2 className="mt-1 text-3xl font-semibold">{slot.exerciseName}</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          {slot.reps !== null ? `${slot.reps} repetitions` : 'Tenue'}
          {timed
            ? ` — ${TIMER_MODE_LABELS[slot.timerMode].toLowerCase()} ${target} s`
            : ''}
        </p>
      </div>

      {timed ? (
        <div className="space-y-3">
          {/* Chiffre de tete : lisible a bout de bras, et colore par l'etat
              plutot que par decor — lime quand l'objectif est tenu, rouge
              quand la limite est franchie. */}
          <p
            className="figure-hero text-center text-7xl font-semibold"
            style={{ color: timerColor }}
            aria-live="off"
          >
            {formatDuration(shown)}
          </p>

          {reached ? (
            <p className="text-muted-foreground text-center text-sm">
              {slot.timerMode === 'minimal'
                ? 'Objectif atteint — tu peux tenir plus longtemps.'
                : 'Limite depassee.'}
            </p>
          ) : null}

          {/* La couleur seule ne porte jamais une information : quand le
              chrono strict quitte le vert, le texte le dit aussi. */}
          {slot.timerMode === 'strict' && urgency > 0 && !reached ? (
            <p className="text-muted-foreground text-center text-sm">
              Plus que {formatDuration(shown)} avant la limite.
            </p>
          ) : null}

          {startedAt === null ? (
            <Button
              type="button"
              className="h-14 w-full text-base"
              size="lg"
              onClick={() => setStartedAt(Date.now())}
            >
              Demarrer le chrono
            </Button>
          ) : (
            <Button
              type="button"
              className="h-14 w-full text-base"
              size="lg"
              onClick={recordTimed}
            >
              {slot.timerMode === 'minimal' ? 'Arreter — j ai tenu' : 'Termine'}
            </Button>
          )}
        </div>
      ) : null}

      {!timed && !failing ? (
        <div className="grid gap-2">
          <Button
            type="button"
            size="lg"
            className="h-14 text-base"
            onClick={() =>
              onRecord({ success: true, repsDone: slot.reps, durationSeconds: null })
            }
          >
            Serie reussie
          </Button>
          <Button
            type="button"
            size="lg"
            variant="outline"
            className="h-14 text-base"
            onClick={() => setFailing(true)}
          >
            Serie manquee
          </Button>
        </div>
      ) : null}

      {!timed && failing ? (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="reps-done">Repetitions atteintes</Label>
            <Input
              id="reps-done"
              ref={repsInput}
              type="number"
              inputMode="numeric"
              min={0}
              max={slot.reps ?? undefined}
              defaultValue={0}
              autoFocus
            />
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              onClick={() => {
                onRecord({ success: false, repsDone: readReps(), durationSeconds: null })
                reset()
              }}
            >
              Enregistrer l&apos;echec
            </Button>
            <Button type="button" variant="ghost" onClick={() => setFailing(false)}>
              Annuler
            </Button>
          </div>
        </div>
      ) : null}

      {timed && startedAt !== null ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-full"
          onClick={reset}
        >
          Remettre le chrono a zero
        </Button>
      ) : null}
    </div>
  )
}
