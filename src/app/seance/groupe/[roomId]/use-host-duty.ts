'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

import { HEARTBEAT_INTERVAL_MS, hostCandidate, hostStale } from '@/lib/session/group/host'
import type { Room } from '@/lib/session/group/model'
import { startDelay, startTimer, stopDelay, stopTimer } from '@/lib/session/timers'
import { useNow } from '@/lib/session/use-now'

import type { ClaimHostResult } from '../action-state'
import { claimRoomHost, heartbeatRoom } from '../actions'

/** Duree d'affichage du bandeau « Tu es maintenant l'hôte ». */
export const HOST_BANNER_MS = 6_000

/**
 * Rythme auquel un candidat regarde si l'hote est devenu silencieux. Une
 * seconde de retard sur un seuil de quinze ne se voit pas.
 */
const STALE_CHECK_MS = 1_000

export type HostDuty = {
  /** L'appareil tient le salon : il bat, et fait avancer le groupe. */
  isHost: boolean
  /** On vient de le devenir : le bandeau l'annonce un instant. */
  becameHost: boolean
  /** Prise de main refusee pour une autre raison qu'un hote deja en place. */
  error: string | null
}

/**
 * Battement de l'hote et prise de main, cote appareil.
 *
 * L'hote se manifeste toutes les HEARTBEAT_INTERVAL_MS tant que le salon vit.
 * Les autres le regardent : si l'hote a quitte la presence et se tait depuis
 * plus que le seuil, le membre present entre le plus tot reclame sa place.
 * Tant que le silence dure, il retente a chaque HEARTBEAT_INTERVAL_MS, quelle
 * que soit l'issue de la tentative precedente : une coupure, une erreur, ou
 * meme un refus host_alive -- l'horloge de l'appareil peut avancer sur celle
 * du serveur -- ne doivent pas laisser le salon sans hote jusqu'a un
 * rafraichissement. Un nouveau battement, ou un nouvel hote, autorise une
 * tentative immediate. La base tranche (claim_room_host) : de deux candidats,
 * un seul passe, et un hote vivant garde sa place.
 *
 * L'ancien hote depossede pendant une coupure l'apprend a son battement
 * suivant : il cesse de battre et redevient invite sans attendre la
 * relecture, qui le confirmera.
 *
 * `active` borne le role a un ecran : le salon d'attente tant qu'il est
 * ouvert, le coureur pendant la seance. Un salon termine n'a plus d'hote.
 */
export function useHostDuty({
  room,
  presentIds,
  userId,
  reload,
  active,
}: {
  room: Room
  presentIds: ReadonlySet<string>
  userId: string
  reload: () => Promise<void>
  active: boolean
}): HostDuty {
  const roomId = room.id
  // Un hote et son dernier battement : la prise de main se juge sur ce
  // couple, et la depossession le fige.
  const beatKey = `${room.hostId}|${room.hostSeenAt}`

  // Couple du salon au moment ou la base nous a dit ne plus etre l'hote. Tant
  // que le salon relu n'a pas change, on n'y croit plus.
  const [deposedAt, setDeposedAt] = useState<string | null>(null)
  const isHost = active && room.hostId === userId && deposedAt !== beatKey

  const reloadRef = useRef(reload)
  const beatKeyRef = useRef(beatKey)
  useEffect(() => {
    reloadRef.current = reload
    beatKeyRef.current = beatKey
  })

  // Battement : tout de suite, puis a intervalle, tant qu'on tient le salon.
  useEffect(() => {
    if (!isHost) return

    let live = true
    const beat = async () => {
      // Perdu en route : rien a en conclure, le suivant partira a son heure.
      const outcome = await heartbeatRoom(roomId).catch(() => null)
      if (!live || !outcome?.deposed) return
      setDeposedAt(beatKeyRef.current)
      void reloadRef.current()
    }
    void beat()
    const handle = startTimer(() => void beat(), HEARTBEAT_INTERVAL_MS)
    return () => {
      live = false
      stopTimer(handle)
    }
  }, [isHost, roomId])

  // Prise de main : on se compte present, que sa propre presence soit deja
  // revenue du canal ou non.
  const present = useMemo(() => new Set([...presentIds, userId]), [presentIds, userId])
  const candidate =
    active &&
    room.hostId !== userId &&
    hostCandidate(room.members, present, room.hostId) === userId
  const now = useNow(candidate, STALE_CHECK_MS)
  // Derniere tentative : le couple qu'elle visait, et son heure. Une seule a
  // la fois en vol.
  const lastClaim = useRef<{ key: string; at: number } | null>(null)
  const claiming = useRef(false)
  const mounted = useRef(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  useEffect(() => {
    if (!candidate || claiming.current) return
    if (!hostStale(room.hostSeenAt, now)) return
    const last = lastClaim.current
    if (last && last.key === beatKey && now - last.at < HEARTBEAT_INTERVAL_MS) return

    lastClaim.current = { key: beatKey, at: now }
    claiming.current = true
    void claimRoomHost(roomId)
      .catch((): ClaimHostResult => ({
        claimed: false,
        error: "Tu n'as pas pu prendre la main.",
      }))
      .then((outcome) => {
        claiming.current = false
        if (!mounted.current) return
        setError(outcome.error)
        // Prise : le salon a change d'hote, on le relit sans attendre
        // l'evenement.
        if (outcome.claimed) void reloadRef.current()
      })
  }, [beatKey, candidate, now, room.hostSeenAt, roomId])

  // Bandeau : a la bascule d'invite a hote, pas pour l'hote d'origine.
  const [wasHost, setWasHost] = useState(isHost)
  const [becameHost, setBecameHost] = useState(false)
  if (wasHost !== isHost) {
    setWasHost(isHost)
    setBecameHost(isHost)
  }

  useEffect(() => {
    if (!becameHost) return
    const handle = startDelay(() => setBecameHost(false), HOST_BANNER_MS)
    return () => stopDelay(handle)
  }, [becameHost])

  return { isHost, becameHost, error }
}
