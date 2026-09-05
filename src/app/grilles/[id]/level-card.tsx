'use client'

import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import type { Exercise } from '@/lib/database.types'
import type { EditorLevel } from '@/lib/grids/queries'
import {
  MAX_EXERCISES_PER_LEVEL,
  describeExercise,
  moveItem,
} from '@/lib/grids/validation'

import {
  addLevelExercise,
  deleteLevel,
  deleteLevelExercise,
  duplicateLevel,
  duplicateLevelExercise,
  renameLevel,
  reorderLevelExercises,
  reorderLevels,
  updateLevelExercise,
} from '../actions'
import { ExerciseForm } from './exercise-form'

/** Bouton de formulaire qui n'affiche qu'une icone textuelle. */
function IconAction({
  action,
  label,
  symbol,
  disabled,
  fields,
  confirmMessage,
}: {
  action: (formData: FormData) => Promise<void>
  label: string
  symbol: string
  disabled?: boolean
  fields: Record<string, string>
  confirmMessage?: string
}) {
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (confirmMessage && !window.confirm(confirmMessage)) {
          event.preventDefault()
        }
      }}
    >
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <Button
        type="submit"
        size="icon-sm"
        variant="ghost"
        disabled={disabled}
        aria-label={label}
        title={label}
      >
        <span aria-hidden>{symbol}</span>
      </Button>
    </form>
  )
}

export function LevelCard({
  gridId,
  level,
  levelCount,
  levelIds,
  exercises,
  defaultOpen,
}: {
  gridId: string
  level: EditorLevel
  levelCount: number
  levelIds: string[]
  exercises: Exercise[]
  defaultOpen: boolean
}) {
  const [addingExercise, setAddingExercise] = useState(false)
  const [editingRowId, setEditingRowId] = useState<string | null>(null)

  const index = levelIds.indexOf(level.id)
  const rowIds = level.exercises.map((e) => e.id)
  const count = level.exercises.length
  const isFull = count >= MAX_EXERCISES_PER_LEVEL

  return (
    <Card>
      <CardHeader className="gap-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span className="bg-muted text-muted-foreground flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-medium">
              {level.position}
            </span>
            <form action={renameLevel} className="min-w-0 flex-1">
              <input type="hidden" name="gridId" value={gridId} />
              <input type="hidden" name="levelId" value={level.id} />
              <Input
                name="name"
                defaultValue={level.name ?? ''}
                placeholder={`Niveau ${level.position}`}
                aria-label={`Nom du niveau ${level.position}`}
                // Enregistre a la sortie du champ : pas de bouton a chercher.
                onBlur={(event) => event.currentTarget.form?.requestSubmit()}
              />
            </form>
          </div>

          <div className="flex shrink-0 items-center">
            <IconAction
              action={reorderLevels}
              label="Monter le niveau"
              symbol="↑"
              disabled={index <= 0}
              fields={{ gridId, orderedIds: moveItem(levelIds, index, -1).join(',') }}
            />
            <IconAction
              action={reorderLevels}
              label="Descendre le niveau"
              symbol="↓"
              disabled={index < 0 || index >= levelCount - 1}
              fields={{ gridId, orderedIds: moveItem(levelIds, index, 1).join(',') }}
            />
            <IconAction
              action={duplicateLevel}
              label="Dupliquer le niveau"
              symbol="⧉"
              fields={{ gridId, levelId: level.id }}
            />
            <IconAction
              action={deleteLevel}
              label="Supprimer le niveau"
              symbol="✕"
              fields={{ gridId, levelId: level.id }}
              confirmMessage={`Supprimer le niveau ${level.position} et ses exercices ?`}
            />
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {/*
          <details> plutot qu'un etat React : une grille de dix niveaux tient
          alors dans un ecran, et il n'y a rien de plus a hydrater.
        */}
        <details open={defaultOpen} className="group">
          <summary className="text-muted-foreground cursor-pointer list-none text-sm">
            <span className="group-open:hidden">
              {count === 0
                ? 'Aucun exercice — deplier'
                : `${count} exercice${count > 1 ? 's' : ''} — deplier`}
            </span>
            <span className="hidden group-open:inline">Replier</span>
          </summary>

          <div className="mt-3 space-y-3">
            {count === 0 ? (
              <p className="text-muted-foreground text-sm">
                Aucun exercice. Un niveau vide ne peut pas etre valide en seance.
              </p>
            ) : (
              <ul className="divide-border divide-y">
                {level.exercises.map((exercise, exerciseIndex) => (
                  <li key={exercise.id} className="py-2">
                    {editingRowId === exercise.id ? (
                      <ExerciseForm
                        action={updateLevelExercise}
                        gridId={gridId}
                        exercises={exercises}
                        submitLabel="Enregistrer"
                        initial={{
                          rowId: exercise.id,
                          exerciseId: exercise.exerciseId,
                          sets: exercise.sets,
                          reps: exercise.reps,
                          timerMode: exercise.timerMode,
                          timerSeconds: exercise.timerSeconds,
                        }}
                        onDone={() => setEditingRowId(null)}
                      />
                    ) : (
                      <div className="flex items-center justify-between gap-2">
                        <button
                          type="button"
                          className="min-w-0 flex-1 text-left"
                          onClick={() => setEditingRowId(exercise.id)}
                        >
                          <span className="block truncate text-sm font-medium">
                            {exercise.exerciseName}
                          </span>
                          <span className="text-muted-foreground block text-xs">
                            {describeExercise(exercise)}
                          </span>
                        </button>

                        <div className="flex shrink-0 items-center">
                          <IconAction
                            action={reorderLevelExercises}
                            label="Monter l'exercice"
                            symbol="↑"
                            disabled={exerciseIndex === 0}
                            fields={{
                              gridId,
                              levelId: level.id,
                              orderedIds: moveItem(rowIds, exerciseIndex, -1).join(','),
                            }}
                          />
                          <IconAction
                            action={reorderLevelExercises}
                            label="Descendre l'exercice"
                            symbol="↓"
                            disabled={exerciseIndex === rowIds.length - 1}
                            fields={{
                              gridId,
                              levelId: level.id,
                              orderedIds: moveItem(rowIds, exerciseIndex, 1).join(','),
                            }}
                          />
                          <IconAction
                            action={duplicateLevelExercise}
                            label="Dupliquer l'exercice"
                            symbol="⧉"
                            disabled={isFull}
                            fields={{ gridId, rowId: exercise.id }}
                          />
                          <IconAction
                            action={deleteLevelExercise}
                            label="Supprimer l'exercice"
                            symbol="✕"
                            fields={{ gridId, rowId: exercise.id }}
                          />
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {addingExercise ? (
              <div className="border-border rounded-lg border p-3">
                <ExerciseForm
                  action={addLevelExercise}
                  gridId={gridId}
                  levelId={level.id}
                  exercises={exercises}
                  submitLabel="Ajouter"
                  // Reste ouvert apres un ajout reussi : remplir un niveau,
                  // c'est enchainer plusieurs exercices d'affilee.
                  stayOpenOnSuccess
                  onDone={() => setAddingExercise(false)}
                />
              </div>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={isFull}
                onClick={() => setAddingExercise(true)}
              >
                {isFull
                  ? `Maximum de ${MAX_EXERCISES_PER_LEVEL} exercices atteint`
                  : 'Ajouter un exercice'}
              </Button>
            )}
          </div>
        </details>
      </CardContent>
    </Card>
  )
}
