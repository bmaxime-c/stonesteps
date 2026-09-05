'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

import { deleteGrid, renameGrid } from '../actions'
import { emptyActionState } from '../action-state'

function SaveButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? 'Un instant…' : 'Enregistrer'}
    </Button>
  )
}

export function GridSettings({
  gridId,
  name,
  description,
  isActive,
}: {
  gridId: string
  name: string
  description: string | null
  isActive: boolean
}) {
  const [state, formAction] = useActionState(renameGrid, emptyActionState)

  return (
    <header className="space-y-3">
      {isActive ? (
        <span className="bg-muted text-muted-foreground inline-block rounded-full px-2 py-0.5 text-xs">
          Grille active
        </span>
      ) : null}

      <form action={formAction} className="space-y-3">
        <input type="hidden" name="gridId" value={gridId} />

        {state.error ? (
          <Alert variant="destructive">
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        ) : null}

        <div className="space-y-1.5">
          <Label htmlFor="grid-name">Nom de la grille</Label>
          <Input id="grid-name" name="name" defaultValue={name} required />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="grid-description">Description</Label>
          <Input
            id="grid-description"
            name="description"
            defaultValue={description ?? ''}
            placeholder="Optionnelle"
          />
        </div>

        <div className="flex items-center gap-2">
          <SaveButton />
          {state.notice ? (
            <span className="text-muted-foreground text-xs">{state.notice}</span>
          ) : null}
        </div>
      </form>

      <form
        action={deleteGrid}
        onSubmit={(event) => {
          if (
            !window.confirm(
              `Supprimer « ${name} » ? Les niveaux, les exercices et l'historique des seances liees seront perdus.`,
            )
          ) {
            event.preventDefault()
          }
        }}
      >
        <input type="hidden" name="gridId" value={gridId} />
        <Button type="submit" size="sm" variant="destructive">
          Supprimer la grille
        </Button>
      </form>
    </header>
  )
}
