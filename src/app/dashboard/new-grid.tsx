'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

import { emptyActionState } from '../grilles/action-state'
import { createGrid } from '../grilles/actions'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? 'Un instant…' : 'Creer'}
    </Button>
  )
}

export function NewGrid() {
  const [open, setOpen] = useState(false)
  const [state, formAction] = useActionState(createGrid, emptyActionState)

  if (!open) {
    return (
      <Button type="button" onClick={() => setOpen(true)}>
        Nouvelle grille
      </Button>
    )
  }

  return (
    <form
      action={formAction}
      className="border-border w-full space-y-3 rounded-lg border p-3"
    >
      {state.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor="new-grid-name">Nom de la grille</Label>
        <Input id="new-grid-name" name="name" placeholder="Ma progression" required />
      </div>

      <div className="flex gap-2">
        <SubmitButton />
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Annuler
        </Button>
      </div>
    </form>
  )
}
