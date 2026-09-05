'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import type { Exercise, TimerMode } from '@/lib/database.types'
import { TIMER_MODE_HINTS, TIMER_MODE_LABELS, TIMER_MODES } from '@/lib/grids/validation'

import { emptyActionState, type ActionState } from '../action-state'

type FormAction = (state: ActionState, formData: FormData) => Promise<ActionState>

export interface ExerciseFormValues {
  rowId?: string
  exerciseId: string
  sets: number
  reps: number | null
  timerMode: TimerMode
  timerSeconds: number | null
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? 'Un instant…' : label}
    </Button>
  )
}

export function ExerciseForm({
  action,
  gridId,
  levelId,
  exercises,
  initial,
  submitLabel,
  onDone,
}: {
  action: FormAction
  gridId: string
  levelId?: string
  exercises: Exercise[]
  initial?: ExerciseFormValues
  submitLabel: string
  onDone?: () => void
}) {
  const [state, formAction] = useActionState(
    async (prev: ActionState, data: FormData) => {
      const result = await action(prev, data)
      if (!result.error) onDone?.()
      return result
    },
    emptyActionState,
  )

  const [timerMode, setTimerMode] = useState<TimerMode>(initial?.timerMode ?? 'none')

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="gridId" value={gridId} />
      {levelId ? <input type="hidden" name="levelId" value={levelId} /> : null}
      {initial?.rowId ? <input type="hidden" name="rowId" value={initial.rowId} /> : null}

      {state.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor={`exercise-${initial?.rowId ?? levelId}`}>Exercice</Label>
        <Select
          id={`exercise-${initial?.rowId ?? levelId}`}
          name="exerciseId"
          defaultValue={initial?.exerciseId ?? ''}
          required
        >
          <option value="" disabled>
            Choisir un exercice…
          </option>
          {exercises.map((exercise) => (
            <option key={exercise.id} value={exercise.id}>
              {exercise.name}
              {exercise.is_builtin ? '' : ' (perso)'}
            </option>
          ))}
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor={`sets-${initial?.rowId ?? levelId}`}>Series</Label>
          <Input
            id={`sets-${initial?.rowId ?? levelId}`}
            name="sets"
            type="number"
            inputMode="numeric"
            min={1}
            max={20}
            defaultValue={initial?.sets ?? 3}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`reps-${initial?.rowId ?? levelId}`}>Repetitions</Label>
          <Input
            id={`reps-${initial?.rowId ?? levelId}`}
            name="reps"
            type="number"
            inputMode="numeric"
            min={1}
            defaultValue={initial?.reps ?? ''}
            placeholder="—"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`timer-${initial?.rowId ?? levelId}`}>Chrono</Label>
        <Select
          id={`timer-${initial?.rowId ?? levelId}`}
          name="timerMode"
          value={timerMode}
          onChange={(event) => setTimerMode(event.target.value as TimerMode)}
        >
          {TIMER_MODES.map((mode) => (
            <option key={mode} value={mode}>
              {TIMER_MODE_LABELS[mode]}
            </option>
          ))}
        </Select>
        <p className="text-muted-foreground text-xs">{TIMER_MODE_HINTS[timerMode]}</p>
      </div>

      {timerMode !== 'none' ? (
        <div className="space-y-1.5">
          <Label htmlFor={`seconds-${initial?.rowId ?? levelId}`}>Duree (secondes)</Label>
          <Input
            id={`seconds-${initial?.rowId ?? levelId}`}
            name="timerSeconds"
            type="number"
            inputMode="numeric"
            min={1}
            defaultValue={initial?.timerSeconds ?? ''}
            required
          />
        </div>
      ) : null}

      <div className="flex gap-2">
        <SubmitButton label={submitLabel} />
        {onDone ? (
          <Button type="button" size="sm" variant="ghost" onClick={onDone}>
            Annuler
          </Button>
        ) : null}
      </div>
    </form>
  )
}
