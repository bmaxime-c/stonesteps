'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { createRoom } from './actions'

/**
 * Ouvre un salon sur une grille et y entre.
 *
 * A cote du lancement solo, sur l'ecran d'ou l'on lance une seance : jamais
 * depuis l'onglet Grilles, qui sert a les ecrire. Le niveau ne se choisit pas
 * ici mais dans le salon, une fois connus les plafonds de chacun.
 */
export function OpenRoomButton({ gridId }: { gridId: string }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        onClick={() => {
          setError(null)
          startTransition(async () => {
            const result = await createRoom(gridId)
            if (result.error !== null) {
              setError(result.error)
              return
            }
            router.push(`/seance/groupe/${result.roomId}`)
          })
        }}
        disabled={pending}
        className="border-border-strong w-full rounded-full border-[1.5px] py-4 text-center text-[16px] font-bold disabled:opacity-50"
      >
        {pending ? 'Ouverture du salon…' : 'Séance à plusieurs'}
      </button>
      {error ? (
        <p className="text-fail text-center text-[13px] font-semibold">{error}</p>
      ) : null}
    </div>
  )
}
