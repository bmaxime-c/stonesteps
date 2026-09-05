import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Hors ligne' }

/**
 * Page servie par le service worker quand une navigation echoue faute de
 * reseau. Volontairement statique : elle doit tenir dans le cache et
 * s'afficher sans aucun appel serveur.
 */
export default function OfflinePage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
      <h1 className="text-2xl font-semibold">Pas de reseau</h1>
      <p className="text-muted-foreground max-w-sm text-balance">
        StoneSteps n&apos;arrive pas a joindre le serveur. Reessaie une fois la connexion
        revenue.
      </p>
    </main>
  )
}
