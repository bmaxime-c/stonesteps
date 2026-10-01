import 'server-only'

import { logSupabaseError } from '@/lib/supabase/log'
import { createClient } from '@/lib/supabase/server'

import type { Room } from './model'
import { fetchRoom } from './room-row'

/** Un salon, ses membres et leurs noms, tels que les voit l'utilisateur. */
export async function loadRoom(roomId: string): Promise<Room | null> {
  const supabase = await createClient()

  const { room, error } = await fetchRoom(supabase, roomId)
  if (!room) {
    logSupabaseError('loadRoom', error)
    return null
  }
  return room
}
