'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { initials } from '@/lib/grids/describe'
import {
  addExercise,
  addLevel,
  addSet,
  cycleTimerMode,
  duplicatePreviousLevel,
  MODE_LABELS,
  removeExercise,
  removeLevel,
  removeSet,
  stepReps,
  stepRest,
  stepSeconds,
  showsReps,
  showsSeconds,
  updateSet,
  type EditableGrid,
  type EditableSet,
} from '@/lib/grids/draft'
import type { CatalogExercise } from '@/lib/grids/queries'
import { cn } from '@/lib/utils'

import { deleteGrid, saveGrid } from './actions'
import { ExerciseLibrary } from './exercise-library'

/**
 * Constructeur de grille.
 *
 * Il travaille sur un brouillon client du debut a la fin, et n'enregistre
 * qu'en une action : l'arbre entier part d'un coup. Toutes les regles
 * d'edition — pas de reglage, cycle des modes, duplication — vivent dans
 * `lib/grids/draft`, ou elles sont testees ; ce composant ne fait que les
 * appeler.
 */
export function GridBuilder({
  gridId,
  initial,
  catalog,
}: {
  gridId: string | null
  initial: EditableGrid
  catalog: CatalogExercise[]
}) {
  const router = useRouter()
  const [grid, setGrid] = useState(initial)
  const [levelIndex, setLevelIndex] = useState(0)
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const level = grid.levels[levelIndex]

  function save() {
    setError(null)
    startTransition(async () => {
      const result = await saveGrid({
        gridId,
        name: grid.name,
        accentColor: grid.accentColor,
        restSeconds: grid.restSeconds,
        levels: grid.levels.map((current) => ({
          exercises: current.exercises.map((exercise) => ({
            exerciseId: exercise.exerciseId,
            exerciseName: exercise.exerciseName,
            sets: exercise.sets.map((set) => ({
              targetReps: set.targetReps,
              timerMode: set.timerMode,
              timerSeconds: set.timerSeconds,
            })),
          })),
        })),
      })

      if (result.error) {
        setError(result.error)
        return
      }
      router.push(`/grilles/${result.gridId}`)
    })
  }

  function remove() {
    if (!gridId) return
    startTransition(async () => {
      const result = await deleteGrid(gridId)
      if (result.error) {
        setError(result.error)
        setConfirmingDelete(false)
        return
      }
      router.push('/')
    })
  }

  if (libraryOpen && level) {
    return (
      <ExerciseLibrary
        catalog={catalog}
        levelNumber={levelIndex + 1}
        onBack={() => setLibraryOpen(false)}
        onPick={(exercise) => {
          setGrid((current) =>
            addExercise(current, levelIndex, {
              exerciseId: exercise.id,
              exerciseName: exercise.name,
            }),
          )
          setLibraryOpen(false)
        }}
      />
    )
  }

  return (
    <main className="gutter mx-auto flex w-full max-w-[760px] flex-col gap-4 pt-[clamp(20px,3vw,36px)] pb-[72px]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[clamp(22px,3.4vw,28px)] font-bold tracking-[-0.02em]">
          {gridId ? 'Modifier la grille' : 'Nouvelle grille'}
        </h1>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => router.push(gridId ? `/grilles/${gridId}` : '/')}
            className="border-border-strong text-muted-foreground rounded-full border px-4 py-2.5 text-sm font-semibold"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="bg-primary text-primary-foreground rounded-full px-[18px] py-2.5 text-sm font-bold disabled:opacity-50"
          >
            {pending ? 'Un instant…' : 'Enregistrer'}
          </button>
        </div>
      </div>

      {error ? (
        <p className="border-fail/40 bg-fail/10 rounded-[14px] border px-4 py-3 text-sm font-semibold">
          {error}
        </p>
      ) : null}

      <input
        value={grid.name}
        onChange={(event) => setGrid({ ...grid, name: event.target.value })}
        placeholder="Nom de la grille"
        aria-label="Nom de la grille"
        maxLength={60}
        className="bg-card border-border-strong text-foreground placeholder:text-tertiary w-full rounded-[12px] border-[1.5px] px-4 py-3.5 text-base outline-none focus-visible:border-[var(--ring)]"
      />

      <div className="bg-card border-border flex flex-wrap items-center gap-3 rounded-[16px] border px-4 py-3.5">
        <div className="min-w-[160px] flex-1">
          <p className="text-sm font-bold">Repos entre les séries</p>
          <p className="text-tertiary mt-0.5 text-xs">
            Optionnel — 0 pour enchaîner directement
          </p>
        </div>
        <Stepper
          label="repos"
          value={grid.restSeconds === 0 ? 'désactivé' : `${grid.restSeconds}s`}
          width="min-w-[78px]"
          onDecrease={() => setGrid(stepRest(grid, -1))}
          onIncrease={() => setGrid(stepRest(grid, 1))}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-tertiary mr-1 text-xs font-bold tracking-[0.06em] uppercase">
          Niveaux
        </span>
        {grid.levels.map((current, index) => (
          <button
            key={current.key}
            type="button"
            onClick={() => setLevelIndex(index)}
            aria-pressed={index === levelIndex}
            className={cn(
              'flex h-9 min-w-9 items-center justify-center rounded-[12px] border-[1.5px] px-2.5 text-sm font-bold',
              index === levelIndex
                ? 'bg-primary text-primary-foreground border-transparent'
                : 'bg-inset text-muted-foreground border-border',
            )}
          >
            {index + 1}
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            setGrid(addLevel(grid))
            setLevelIndex(grid.levels.length)
          }}
          className="border-border text-success flex h-9 items-center justify-center rounded-[12px] border-[1.5px] border-dashed px-3.5 text-[13px] font-bold"
        >
          + Niveau
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[15px] font-bold">Niveau {levelIndex + 1}</p>
        {grid.levels.length > 1 ? (
          <button
            type="button"
            onClick={() => {
              setGrid(removeLevel(grid, levelIndex))
              setLevelIndex(Math.max(0, levelIndex - 1))
            }}
            className="text-tertiary p-1 text-[13px] font-semibold"
          >
            Supprimer ce niveau
          </button>
        ) : null}
      </div>

      {/* La duplication n'a de sens que sur un niveau vide : sinon elle
          ecraserait un contenu deja saisi. */}
      {levelIndex > 0 && level && level.exercises.length === 0 ? (
        <button
          type="button"
          onClick={() => setGrid(duplicatePreviousLevel(grid, levelIndex))}
          className="border-border text-muted-foreground self-start rounded-full border-[1.5px] border-dashed px-3.5 py-2.5 text-[13px] font-semibold"
        >
          Dupliquer le niveau précédent
        </button>
      ) : null}

      {level?.exercises.map((exercise, exerciseIndex) => (
        <div
          key={exercise.key}
          className="bg-card border-border flex flex-col gap-2.5 rounded-[20px] border p-4"
        >
          <div className="flex items-center gap-3">
            <span
              className="text-ink-neon flex size-[38px] shrink-0 items-center justify-center rounded-[12px] text-[13px] font-bold"
              style={{ background: grid.accentColor }}
              aria-hidden="true"
            >
              {initials(exercise.exerciseName)}
            </span>
            <p className="min-w-0 flex-1 truncate text-base font-bold">
              {exercise.exerciseName}
            </p>
            <button
              type="button"
              aria-label={`Retirer ${exercise.exerciseName}`}
              onClick={() => setGrid(removeExercise(grid, levelIndex, exerciseIndex))}
              className="bg-chip text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-full text-base"
            >
              ×
            </button>
          </div>

          {exercise.sets.map((set, setIndex) => (
            <SetRow
              key={set.key}
              set={set}
              index={setIndex}
              total={exercise.sets.length}
              onChange={(change) =>
                setGrid(updateSet(grid, levelIndex, exerciseIndex, setIndex, change))
              }
              onRemove={() =>
                setGrid(removeSet(grid, levelIndex, exerciseIndex, setIndex))
              }
            />
          ))}

          <button
            type="button"
            onClick={() => setGrid(addSet(grid, levelIndex, exerciseIndex))}
            className="border-border text-muted-foreground self-start rounded-full border-[1.5px] border-dashed px-3.5 py-2.5 text-[13px] font-semibold"
          >
            + Ajouter une série
          </button>
        </div>
      ))}

      {level && level.exercises.length === 0 ? (
        <p className="text-tertiary p-2 text-center text-sm">
          Aucun exercice dans ce niveau. Ajoutez-en depuis la bibliothèque.
        </p>
      ) : null}

      <button
        type="button"
        onClick={() => setLibraryOpen(true)}
        className="bg-card border-border text-success rounded-[16px] border-[1.5px] border-dashed p-4 text-center text-[15px] font-bold"
      >
        + Ajouter un exercice
      </button>

      {gridId ? (
        <button
          type="button"
          onClick={() => setConfirmingDelete(true)}
          className="text-fail self-center p-2 text-[13px] font-semibold"
        >
          Supprimer cette grille
        </button>
      ) : null}

      {confirmingDelete ? (
        <ConfirmDialog
          title="Supprimer cette grille ?"
          description="Ses niveaux et sa progression partent avec elle. Les séances déjà jouées restent dans les statistiques."
          confirmLabel="Supprimer"
          onCancel={() => setConfirmingDelete(false)}
          onConfirm={remove}
        />
      ) : null}
    </main>
  )
}

/** Une ligne de serie : libelle, reps, mode, secondes, retrait. */
function SetRow({
  set,
  index,
  total,
  onChange,
  onRemove,
}: {
  set: EditableSet
  index: number
  total: number
  onChange: (change: (set: EditableSet) => EditableSet) => void
  onRemove: () => void
}) {
  return (
    <div className="bg-inset flex flex-wrap items-center gap-2.5 rounded-[14px] px-3 py-2.5">
      <span className="text-tertiary min-w-[54px] text-xs font-bold">
        Série {index + 1}/{total}
      </span>

      {showsReps(set) ? (
        <Stepper
          label="répétitions"
          value={`${set.targetReps} reps`}
          width="min-w-[62px]"
          onDecrease={() => onChange((current) => stepReps(current, -1))}
          onIncrease={() => onChange((current) => stepReps(current, 1))}
        />
      ) : null}

      <button
        type="button"
        onClick={() => onChange(cycleTimerMode)}
        className={cn(
          'rounded-full px-3 py-2 text-[12.5px] font-semibold whitespace-nowrap',
          set.timerMode === 'none'
            ? 'bg-chip text-muted-foreground'
            : 'bg-success text-ink-neon',
        )}
      >
        {MODE_LABELS[set.timerMode]}
      </button>

      {showsSeconds(set) ? (
        <Stepper
          label="secondes"
          value={`${set.timerSeconds}s`}
          width="min-w-[42px]"
          onDecrease={() => onChange((current) => stepSeconds(current, -1))}
          onIncrease={() => onChange((current) => stepSeconds(current, 1))}
        />
      ) : null}

      <button
        type="button"
        onClick={onRemove}
        className="text-tertiary ml-auto p-1.5 text-[13px] font-semibold"
      >
        Retirer
      </button>
    </div>
  )
}

/**
 * Pas de reglage.
 *
 * 34 px de cote : la cible tactile minimale du constructeur, ou l'on regle
 * assis au calme — la seance, elle, monte a 64 px.
 */
function Stepper({
  label,
  value,
  width,
  onDecrease,
  onIncrease,
}: {
  label: string
  value: string
  width: string
  onDecrease: () => void
  onIncrease: () => void
}) {
  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        aria-label={`Diminuer ${label}`}
        onClick={onDecrease}
        className="bg-chip border-border flex size-[34px] items-center justify-center rounded-full border text-lg select-none"
      >
        &minus;
      </button>
      <span className={cn('text-center text-sm font-bold', width)}>{value}</span>
      <button
        type="button"
        aria-label={`Augmenter ${label}`}
        onClick={onIncrease}
        className="bg-chip border-border flex size-[34px] items-center justify-center rounded-full border text-lg select-none"
      >
        +
      </button>
    </div>
  )
}
