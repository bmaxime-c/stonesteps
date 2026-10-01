'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { createClient } from '@/lib/supabase/client'

import type { Room } from './model'
import { fetchRoom } from './room-row'

export type LiveRoom = {
  room: Room
  /** Utilisateurs connectes au salon en ce moment, un par compte. */
  presentIds: ReadonlySet<string>
  /**
   * Relit le salon sans attendre d'evenement : apres un appel refuse parce
   * que le salon avait bouge, l'evenement qui l'annoncait a pu se perdre.
   */
  reload: () => Promise<void>
}

/**
 * Salon suivi en direct.
 *
 * Part du salon rendu par le serveur, puis le relit a chaque changement du
 * salon, entrees et sorties comprises. Relire plutot que fusionner les evenements : un
 * evenement ne porte ni le nom du participant, ni ce que la RLS laisse voir,
 * et deux evenements rapproches se fusionneraient dans le desordre. La
 * relecture rend toujours l'etat entier, tel que la base le voit.
 *
 * Une exception : le battement de l'hote, qui touche le salon toutes les
 * quelques secondes et ne change que `host_seen_at`. Relire a chaque fois
 * ferait relire tout le salon, membres compris, par chaque participant, pour
 * une seule colonne : on la prend dans l'evenement.
 *
 * La presence est indexee par utilisateur : deux onglets du meme compte
 * partagent une cle, et ne comptent que pour un participant.
 */
export function useRoom(initial: Room, userId: string): LiveRoom {
  const [room, setRoom] = useState(initial)
  const [presentIds, setPresentIds] = useState<ReadonlySet<string>>(() => new Set())
  // Numero de la derniere relecture lancee : une reponse plus ancienne,
  // arrivee apres coup, ne doit pas ecraser une plus recente.
  const latestRead = useRef(0)
  // Relecture du canal en cours, exposee hors de l'effet qui la cree.
  const reloadRef = useRef<(() => Promise<void>) | null>(null)
  // Salon affiche, lu par le gestionnaire d'evenements sans le recreer.
  const roomRef = useRef(initial)
  // roster_changed_at du dernier evenement : s'il n'a pas bouge, aucun membre
  // n'est entre, sorti, ni n'a declare. Inconnu tant qu'aucun n'est arrive.
  const rosterSeen = useRef<string | null>(null)

  useEffect(() => {
    roomRef.current = room
  })

  const roomId = initial.id

  useEffect(() => {
    const supabase = createClient()

    const reload = async () => {
      const read = ++latestRead.current
      const { room: fresh } = await fetchRoom(supabase, roomId)
      // Un salon devenu illisible le temps d'une relecture : on garde le
      // dernier etat connu plutot que de vider l'ecran.
      if (fresh && read === latestRead.current) {
        setRoom((current) => keepLatestBeat(current, fresh))
      }
    }
    reloadRef.current = reload

    // Canal prive : Realtime consulte les policies de realtime.messages avant
    // d'y laisser entrer, et seuls les membres du salon passent.
    const channel = supabase.channel(`room:${roomId}`, {
      config: { presence: { key: userId }, private: true },
    })
    let closed = false

    channel
      // Un seul abonnement : le salon. Une entree ou une sortie le touche
      // (roster_changed_at), et l'evenement passe par la RLS. La table des
      // membres n'est pas publiee : Realtime y diffuserait chaque sortie a
      // tous ses abonnes, identifiant du salon compris.
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'session_rooms',
          filter: `id=eq.${roomId}`,
        },
        (payload: { new?: Record<string, unknown> }) => {
          const row = payload.new
          const beat = heartbeatOnly(row, roomRef.current, rosterSeen.current)
          rosterSeen.current =
            typeof row?.roster_changed_at === 'string' ? row.roster_changed_at : null
          if (beat === null) {
            void reload()
            return
          }
          setRoom((current) => ({ ...current, hostSeenAt: beat }))
        },
      )
      .on('presence', { event: 'sync' }, () => {
        setPresentIds(new Set(Object.keys(channel.presenceState())))
      })

    // Le jeton de session doit etre remis au socket avant de rejoindre : un
    // canal prive rejoint sans lui l'est en anonyme, et les policies le
    // refusent. Le client le transmet de lui-meme a la connexion, mais sans
    // garantie d'arriver avant l'abonnement.
    void supabase.realtime.setAuth().then(() => {
      if (closed) return
      channel.subscribe((status) => {
        if (status !== 'SUBSCRIBED') return
        void channel.track({ user_id: userId })
        // Ce qui a change entre le rendu serveur et l'abonnement n'a declenche
        // aucun evenement : une relecture rattrape ce trou.
        void reload()
      })
    })

    return () => {
      closed = true
      reloadRef.current = null
      void supabase.removeChannel(channel)
    }
  }, [roomId, userId])

  const reload = useCallback(async () => {
    await reloadRef.current?.()
  }, [])

  return { room, presentIds, reload }
}

/** Colonnes du salon que porte `Room`, hors battement. */
const ROOM_COLUMNS = {
  host_id: 'hostId',
  grid_version_id: 'gridVersionId',
  level_id: 'levelId',
  status: 'status',
  cursor: 'cursor',
  stage: 'stage',
  rest_started_at: 'restStartedAt',
} as const satisfies Record<string, keyof Room>

/**
 * Instant du battement si l'evenement n'est rien d'autre, null sinon.
 *
 * Un battement laisse intactes toutes les colonnes affichees et la liste des
 * membres (roster_changed_at). Dans le doute -- evenement sans ligne, liste
 * encore inconnue, instant illisible --, null : on relit, ce qui ne trompe
 * jamais.
 */
function heartbeatOnly(
  row: Record<string, unknown> | undefined,
  room: Room,
  rosterSeen: string | null,
): string | null {
  if (!row || rosterSeen === null || row.roster_changed_at !== rosterSeen) return null
  for (const [column, field] of Object.entries(ROOM_COLUMNS)) {
    if (row[column] !== room[field]) return null
  }
  const seenAt = row.host_seen_at
  if (typeof seenAt !== 'string' || !Number.isFinite(Date.parse(seenAt))) return null
  return seenAt
}

/**
 * Salon relu, sans reculer le battement : une relecture partie avant un
 * battement recu sur place reviendrait avec l'instant precedent, et ferait
 * paraitre l'hote plus silencieux qu'il ne l'est.
 */
function keepLatestBeat(current: Room, fresh: Room): Room {
  if (fresh.hostId !== current.hostId) return fresh
  if (Date.parse(current.hostSeenAt) <= Date.parse(fresh.hostSeenAt)) return fresh
  return { ...fresh, hostSeenAt: current.hostSeenAt }
}
