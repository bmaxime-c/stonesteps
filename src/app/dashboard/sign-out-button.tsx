'use client'

import { Button } from '@/components/ui/button'
import { clearLocalSessions } from '@/lib/session/local-store'

import { signOut } from '../(auth)/actions'

/**
 * Deconnexion.
 *
 * Vide au passage les seances stockees en IndexedDB : elles appartiennent au
 * compte qui quitte l'appareil, pas au suivant. Une seance non synchronisee
 * est donc perdue — c'est le bon arbitrage, la deconnexion etant explicite.
 */
export function SignOutButton() {
  return (
    <form
      action={signOut}
      onSubmit={() => {
        void clearLocalSessions().catch(() => {})
        // Purge aussi le HTML de /seance retenu par le service worker.
        navigator.serviceWorker?.controller?.postMessage('CLEAR_CACHES')
      }}
    >
      <Button type="submit" variant="outline" size="sm">
        Se deconnecter
      </Button>
    </form>
  )
}
