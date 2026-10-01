import 'server-only'

import { logSupabaseError } from '@/lib/supabase/log'
import { createClient } from '@/lib/supabase/server'

import type { Room, RoomEntry } from './model'
import { fetchRoom } from './room-row'

/**
 * Un salon, ses membres et leurs noms, tels que les voit l'utilisateur.
 *
 * Null pour qui n'en est ni l'hote ni un membre : avant d'entrer, voir
 * `loadRoomEntry`.
 */
export async function loadRoom(roomId: string): Promise<Room | null> {
  const supabase = await createClient()

  const { room, error } = await fetchRoom(supabase, roomId)
  if (!room) {
    logSupabaseError('loadRoom', error)
    return null
  }
  return room
}

/**
 * La porte d'un salon : grille, version figee et statut, sans les membres.
 *
 * Lisible par qui connait l'identifiant et peut lire la grille. Null si le
 * salon est inconnu, hors de portee, ou si l'identifiant est mal forme.
 */
export async function loadRoomEntry(roomId: string): Promise<RoomEntry | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .rpc('room_entry', { p_room: roomId })
    .maybeSingle()

  if (error || !data) {
    if (error) logSupabaseError('loadRoomEntry', error)
    return null
  }
  return {
    gridId: data.grid_id,
    gridVersionId: data.grid_version_id,
    status: data.status,
  }
}
