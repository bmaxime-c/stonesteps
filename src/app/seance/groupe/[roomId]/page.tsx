import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { loadGrid } from '@/lib/grids/queries'
import { loadRoom } from '@/lib/session/group/queries'
import { createClient } from '@/lib/supabase/server'

import { joinRoom } from '../actions'
import { Lobby } from './lobby'
import { AdoptToJoin, RoomRefusal } from './refusal'

export const metadata: Metadata = { title: 'Séance à plusieurs' }

const ROOM_UNAVAILABLE = "Ce salon n'existe pas, ou tu n'y as pas accès."

/**
 * Salon d'une seance a plusieurs : on y arrive par le lien partage.
 *
 * Ouvrir le lien, c'est demander a entrer : un non-membre tente l'entree des
 * le rendu, et un membre revient sans rien ecrire. Tant qu'on n'est pas
 * entre, la RLS ne laisse voir que sa propre ligne de membre : la liste des
 * participants n'apparait qu'une fois la porte franchie.
 *
 * Hors du groupe de routes (app), comme la seance solo : plein ecran, sans
 * barre de navigation.
 */
export default async function RoomPage({ params }: PageProps<'/seance/groupe/[roomId]'>) {
  const { roomId } = await params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Le proxy renvoie deja vers la connexion ; ceci couvre une session
  // expiree entre les deux.
  if (!user) redirect(`/login?redirectTo=/seance/groupe/${roomId}`)

  let room = await loadRoom(roomId)

  if (!room?.members.some((member) => member.userId === user.id)) {
    const entry = await joinRoom(roomId)

    if (entry.refusal) {
      // Grille publique pas encore adoptee : on propose de l'adopter plutot
      // que de fermer la porte. Une grille privee ne se lit pas du dehors, et
      // finit en salon introuvable.
      if (entry.refusal === 'not_following' && room) {
        const grid = await loadGrid(room.gridId)
        const version = grid?.publishedVersions.at(-1)
        if (grid?.isPublic && version) {
          return (
            <AdoptToJoin
              gridId={grid.id}
              gridName={version.name}
              ownerName={grid.ownerName}
            />
          )
        }
      }
      return <RoomRefusal message={entry.error} />
    }

    // Entre a l'instant : les autres membres sont desormais lisibles.
    room = await loadRoom(roomId)
  }

  if (!room) return <RoomRefusal message={ROOM_UNAVAILABLE} />

  // Le salon joue sa version figee, pas la version jouable du moment : un
  // createur qui publie pendant la seance ne change rien a ce qui s'y joue.
  const frozenVersionId = room.gridVersionId
  const grid = await loadGrid(room.gridId)
  const version = grid?.publishedVersions.find(
    (candidate) => candidate.id === frozenVersionId,
  )
  if (!version) return <RoomRefusal message={ROOM_UNAVAILABLE} />

  return (
    <Lobby
      initialRoom={room}
      userId={user.id}
      grid={{
        name: version.name,
        version: version.version,
        accentColor: version.accentColor,
      }}
      levels={version.levels.map((level) => ({ id: level.id, position: level.position }))}
    />
  )
}
