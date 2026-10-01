'use client'

import { useEffect, useRef, useState } from 'react'

import { createClient } from '@/lib/supabase/client'

import type { Room } from './model'
import { fetchRoom } from './room-row'

export type LiveRoom = {
  room: Room
  /** Utilisateurs connectes au salon en ce moment, un par compte. */
  presentIds: ReadonlySet<string>
}

const MEMBERS = 'session_room_members'

/**
 * Salon suivi en direct.
 *
 * Part du salon rendu par le serveur, puis le relit a chaque changement du
 * salon ou de ses membres. Relire plutot que fusionner les evenements : un
 * evenement ne porte ni le nom du participant, ni ce que la RLS laisse voir,
 * et deux evenements rapproches se fusionneraient dans le desordre. La
 * relecture rend toujours l'etat entier, tel que la base le voit.
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

  const roomId = initial.id

  useEffect(() => {
    const supabase = createClient()

    const reload = async () => {
      const read = ++latestRead.current
      const { room: fresh } = await fetchRoom(supabase, roomId)
      // Un salon devenu illisible le temps d'une relecture : on garde le
      // dernier etat connu plutot que de vider l'ecran.
      if (fresh && read === latestRead.current) setRoom(fresh)
    }

    const channel = supabase.channel(`room:${roomId}`, {
      config: { presence: { key: userId } },
    })

    channel
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'session_rooms',
          filter: `id=eq.${roomId}`,
        },
        () => void reload(),
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: MEMBERS,
          filter: `room_id=eq.${roomId}`,
        },
        () => void reload(),
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: MEMBERS,
          filter: `room_id=eq.${roomId}`,
        },
        () => void reload(),
      )
      // Les suppressions ne se filtrent pas cote serveur : elles arrivent pour
      // tous les salons, et l'ancienne ligne n'en porte que la cle, qui
      // contient, heureusement, le salon.
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: MEMBERS },
        (payload) => {
          const old = payload.old as { room_id?: string } | undefined
          if (old?.room_id === roomId) void reload()
        },
      )
      .on('presence', { event: 'sync' }, () => {
        setPresentIds(new Set(Object.keys(channel.presenceState())))
      })
      .subscribe((status) => {
        if (status !== 'SUBSCRIBED') return
        void channel.track({ user_id: userId })
        // Ce qui a change entre le rendu serveur et l'abonnement n'a declenche
        // aucun evenement : une relecture rattrape ce trou.
        void reload()
      })

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [roomId, userId])

  return { room, presentIds }
}
