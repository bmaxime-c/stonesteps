import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@/lib/database.types'

import type { Room } from './model'

/**
 * Lecture d'un salon, commune au serveur et au navigateur.
 *
 * Le rendu serveur charge le salon une premiere fois ; le navigateur le relit
 * ensuite a chaque changement. Les deux passent par la meme requete, pour
 * qu'une relecture ne change jamais la forme de ce qui est affiche.
 *
 * La relation vers `profiles` est nommee par sa cle etrangere : le salon en
 * porte une autre, celle de l'hote, et PostgREST refuserait de choisir.
 *
 * La RLS fait le tri : un salon dont on ne peut pas lire la grille ne remonte
 * pas, sauf a en etre l'hote ou un membre. Les membres ne se lisent qu'entre
 * membres : avant d'entrer, on ne voit que sa propre ligne, s'il y en a une.
 * C'est assez pour savoir si l'on revient ; le compte des places, lui, est
 * tenu par le trigger d'entree, qui voit tout le monde.
 */
const ROOM_SELECT = `
  id, grid_id, grid_version_id, host_id, level_id, status, cursor, stage,
  rest_started_at,
  session_room_members (
    user_id, level_ceiling, declared_cursor, last_status, joined_at,
    profiles!session_room_members_user_id_fkey ( display_name )
  )
`

type RoomRow = {
  id: string
  grid_id: string
  grid_version_id: string
  host_id: string
  level_id: string | null
  status: Room['status']
  cursor: number
  stage: Room['stage']
  rest_started_at: string | null
  session_room_members: {
    user_id: string
    level_ceiling: number
    declared_cursor: number
    last_status: Room['members'][number]['lastStatus']
    joined_at: string
    profiles: { display_name: string | null } | null
  }[]
}

function toRoom(row: RoomRow): Room {
  return {
    id: row.id,
    gridId: row.grid_id,
    gridVersionId: row.grid_version_id,
    hostId: row.host_id,
    levelId: row.level_id,
    status: row.status,
    cursor: row.cursor,
    stage: row.stage,
    restStartedAt: row.rest_started_at,
    members: [...row.session_room_members]
      .sort((a, b) => a.joined_at.localeCompare(b.joined_at))
      .map((member) => ({
        userId: member.user_id,
        displayName: member.profiles?.display_name ?? null,
        levelCeiling: member.level_ceiling,
        declaredCursor: member.declared_cursor,
        lastStatus: member.last_status,
        joinedAt: member.joined_at,
      })),
  }
}

export type RoomFetch =
  { room: Room; error: null } | { room: null; error: { message: string } | null }

/**
 * Lit un salon avec le client fourni.
 *
 * L'erreur est rendue et non journalisee : le serveur et le navigateur ne la
 * consignent pas de la meme facon.
 */
export async function fetchRoom(
  supabase: SupabaseClient<Database>,
  roomId: string,
): Promise<RoomFetch> {
  const { data, error } = await supabase
    .from('session_rooms')
    .select(ROOM_SELECT)
    .eq('id', roomId)
    .maybeSingle()

  if (error || !data) return { room: null, error: error ?? null }
  return { room: toRoom(data as unknown as RoomRow), error: null }
}
