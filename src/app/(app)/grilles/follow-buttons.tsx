'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { followGrid, unfollowGrid } from './actions'

/**
 * Adopter ou retirer une grille publiee par quelqu'un d'autre.
 *
 * Deux boutons plutot qu'une bascule : ce ne sont pas deux etats d'un meme
 * reglage, ce sont deux gestes qui ne se font pas au meme endroit — on adopte
 * depuis « Decouvrir », on retire depuis « Mes grilles ».
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
