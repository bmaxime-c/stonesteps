'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { duplicateGrid, followGrid, unfollowGrid } from './actions'

/**
 * Ce qu'on peut faire d'une grille publiee par quelqu'un d'autre : l'adopter,
 * la retirer, ou la dupliquer.
 *
 * Adopter et dupliquer ne sont pas deux facons de faire la meme chose. Adopter
 * garde le lien : le createur publie, on recoit. Dupliquer le coupe — la copie
 * est a soi, et diverge des la premiere modification.
 */

function useGridAction(action: (gridId: string) => Promise<{ error: string | null }>) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const run = (gridId: string) => {
    setError(null)
    startTransition(async () => {
      const result = await action(gridId)
      if (result.error) {
        setError(result.error)
        return
      }
      router.refresh()
    })
  }

  return { run, error, pending }
}

export function AddGridButton({ gridId }: { gridId: string }) {
  const { run, error, pending } = useGridAction(followGrid)

  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      <button
        type="button"
        onClick={() => run(gridId)}
        disabled={pending}
        className="bg-primary text-primary-foreground rounded-full px-4 py-2.5 text-sm font-bold whitespace-nowrap disabled:opacity-50"
      >
        {pending ? 'Un instant…' : 'Ajouter'}
      </button>
      {error ? <p className="text-fail text-[11px] font-semibold">{error}</p> : null}
    </div>
  )
}

export function RemoveGridButton({ gridId }: { gridId: string }) {
  const { run, error, pending } = useGridAction(unfollowGrid)

  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      <button
        type="button"
        onClick={() => run(gridId)}
        disabled={pending}
        className="border-border-strong text-muted-foreground rounded-full border px-4 py-2.5 text-sm font-semibold whitespace-nowrap disabled:opacity-50"
      >
        {pending ? 'Un instant…' : 'Retirer'}
      </button>
      {error ? <p className="text-fail text-[11px] font-semibold">{error}</p> : null}
    </div>
  )
}

/**
 * Duplique la grille vers son propre profil.
 *
 * On atterrit sur la copie : c'est desormais la sienne, et il n'y a pas de
 * raison de rester devant l'originale.
 */
export function DuplicateGridButton({ gridId }: { gridId: string }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      <button
        type="button"
        onClick={() => {
          setError(null)
          startTransition(async () => {
            const result = await duplicateGrid(gridId)
            if (result.error) {
              setError(result.error)
              return
            }
            router.push(`/grilles/${result.gridId}`)
          })
        }}
        disabled={pending}
        className="border-border-strong text-muted-foreground rounded-full border px-4 py-2.5 text-sm font-semibold whitespace-nowrap disabled:opacity-50"
      >
        {pending ? 'Un instant…' : 'Dupliquer'}
      </button>
      {error ? <p className="text-fail text-[11px] font-semibold">{error}</p> : null}
    </div>
  )
}
