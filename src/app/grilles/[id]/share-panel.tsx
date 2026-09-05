import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import type { PersonSummary } from '@/lib/friends/queries'

import { setGridVisibility, shareGridWith, unshareGridWith } from '../actions'

/**
 * Partage d'une grille.
 *
 * Deux mecanismes distincts, volontairement separes : le partage nominatif a
 * un ami, et la publication ouverte a tout membre connecte. Les fondre dans un
 * seul reglage rendrait impossible de partager a une personne sans exposer la
 * grille a tout le monde.
 */
export function SharePanel({
  gridId,
  isPublic,
  friends,
  sharedWith,
}: {
  gridId: string
  isPublic: boolean
  friends: PersonSummary[]
  sharedWith: string[]
}) {
  const shared = new Set(sharedWith)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Partage</CardTitle>
        <CardDescription>
          Tes amis voient toujours ton niveau et ton historique. Partager une grille leur
          permet en plus de la consulter et de la dupliquer.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <form action={setGridVisibility} className="flex items-center gap-2">
          <input type="hidden" name="gridId" value={gridId} />
          <input type="hidden" name="isPublic" value={String(!isPublic)} />
          <Button type="submit" size="sm" variant={isPublic ? 'secondary' : 'outline'}>
            {isPublic ? 'Rendre privee' : 'Rendre publique'}
          </Button>
          <span className="text-muted-foreground text-xs">
            {isPublic
              ? 'Visible et duplicable par tout membre connecte.'
              : 'Visible seulement par toi, tes amis et les personnes choisies.'}
          </span>
        </form>

        {friends.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Aucun ami pour l&apos;instant. Le partage nominatif s&apos;activera quand tu
            en auras.
          </p>
        ) : (
          <ul className="divide-border divide-y">
            {friends.map((friend) => {
              const isShared = shared.has(friend.id)
              return (
                <li
                  key={friend.id}
                  className="flex items-center justify-between gap-2 py-2"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm">
                      {friend.displayName ?? friend.username}
                    </span>
                    <span className="text-muted-foreground block text-xs">
                      @{friend.username}
                    </span>
                  </span>
                  <form action={isShared ? unshareGridWith : shareGridWith}>
                    <input type="hidden" name="gridId" value={gridId} />
                    <input type="hidden" name="personId" value={friend.id} />
                    <Button
                      type="submit"
                      size="sm"
                      variant={isShared ? 'ghost' : 'outline'}
                    >
                      {isShared ? 'Retirer' : 'Partager'}
                    </Button>
                  </form>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
