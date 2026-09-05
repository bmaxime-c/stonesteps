'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'

import { createExercise } from '../actions'
import { emptyActionState } from '../action-state'

const CATEGORIES = [
  { value: 'push', label: 'Poussee' },
  { value: 'pull', label: 'Traction' },
  { value: 'legs', label: 'Jambes' },
  { value: 'core', label: 'Gainage' },
]

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? 'Un instant…' : 'Ajouter au catalogue'}
    </Button>
  )
}

/**
 * Creation d'un exercice personnel, quand le catalogue integre ne suffit pas.
 * L'exercice devient disponible dans tous les niveaux de toutes ses grilles.
 */
export function NewExercise({ gridId }: { gridId: string }) {
  const [open, setOpen] = useState(false)
  const [state, formAction] = useActionState(createExercise, emptyActionState)

  if (!open) {
    return (
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        Creer un exercice
      </Button>
    )
  }

  return (
    <form
      action={formAction}
      className="border-border w-full space-y-3 rounded-lg border p-3"
    >
      <input type="hidden" name="gridId" value={gridId} />

      {state.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      {state.notice ? (
        <Alert>
          <AlertDescription>{state.notice}</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor="new-exercise-name">Nom de l&apos;exercice</Label>
        <Input id="new-exercise-name" name="name" required />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="new-exercise-category">Categorie</Label>
        <Select id="new-exercise-category" name="category" defaultValue="">
          <option value="">Sans categorie</option>
          {CATEGORIES.map((category) => (
            <option key={category.value} value={category.value}>
              {category.label}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex gap-2">
        <SubmitButton />
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Fermer
        </Button>
      </div>
    </form>
  )
}
