'use server'

import type { Grid } from '@/lib/grids/model'
import { gridProgress } from '@/lib/grids/progress'
import { loadGrid } from '@/lib/grids/queries'
import { loadRoom, loadRoomEntry } from '@/lib/session/group/queries'
import { joinRefusal, memberCeiling, type JoinRefusal } from '@/lib/session/group/room'
import type { RoomStage } from '@/lib/session/group/model'
import type { SetStatus } from '@/lib/session/model'
import { loadLevelOutcomes } from '@/lib/session/queries'
import { logSupabaseError } from '@/lib/supabase/log'
import { createClient } from '@/lib/supabase/server'

import type {
  ClaimHostResult,
  CreateRoomResult,
  HeartbeatResult,
  JoinRoomRefusal,
  JoinRoomResult,
  RoomActionResult,
  RoomStepResult,
} from './action-state'

const SESSION_EXPIRED = 'Session expirée. Reconnecte-toi.'

/**
 * Codes levés par la base (P0001), traduits pour l'utilisateur.
 *
 * La base parle en codes et non en phrases : le texte affiché reste ici, a
 * cote des autres messages de l'application.
 */
const DATABASE_MESSAGES: Record<string, string> = {
  room_not_found: "Ce salon n'existe plus.",
  room_started: "La séance est déjà lancée : le salon n'accepte plus personne.",
  room_full: 'Le salon est complet : six participants au maximum.',
  not_room_host: "Seul l'hôte peut lancer la séance.",
  level_not_in_room: "Ce niveau n'appartient pas à la grille du salon.",
  level_above_ceiling:
    "Ce niveau dépasse le plafond du salon : un participant ne l'a pas encore atteint.",
  not_room_member: 'Tu ne fais pas partie de ce salon.',
  room_not_running: "La séance de ce salon n'est pas en cours.",
  stale_cursor: 'Le groupe est déjà passé à la série suivante.',
  room_moved: 'Le groupe a déjà avancé.',
  room_waiting: "Un participant n'a pas encore fini sa série.",
  room_finished: 'La séance de ce salon est terminée.',
  host_alive: "L'hôte est toujours là : il garde la main.",
  host_taken: 'Un autre participant vient de prendre la main.',
  host_not_in_room: 'Rejoins la liste du salon avant de lancer la séance.',
  grid_not_playable: "Cette grille n'est plus jouable : le salon n'a pas pu être ouvert.",
}

/**
 * Codes qui disent seulement que le salon a bouge entre la lecture et
 * l'appel. L'ecran se relit et suit la base : rien a signaler.
 */
const STALE_CODES = new Set(['stale_cursor', 'room_moved', 'room_waiting'])

/**
 * Refus d'une prise de main qui disent seulement que quelqu'un tient deja le
 * salon : l'hote s'est manifeste, ou un autre candidat est passe le premier.
 */
const CLAIM_SILENT_CODES = new Set(['host_alive', 'host_taken'])

function isStale(error: DatabaseError): boolean {
  return error?.code === 'P0001' && STALE_CODES.has(error.message ?? '')
}

const REFUSAL_MESSAGES: Record<JoinRefusal, string> = {
  started: DATABASE_MESSAGES.room_started,
  full: DATABASE_MESSAGES.room_full,
  not_following: 'Adopte cette grille pour rejoindre le salon.',
  version:
    "Ta version de cette grille n'est pas celle du salon : tu ne peux pas y entrer.",
}

const REFUSAL_BY_CODE: Record<string, JoinRoomRefusal> = {
  room_started: 'started',
  room_full: 'full',
  room_not_found: 'not_found',
}

type DatabaseError = { code?: string; message?: string } | null

/**
 * `overrides` precise un code dont le sens depend de l'action : `not_room_host`
 * ne dit pas la meme chose au lancement et a l'avance du groupe.
 */
function databaseMessage(
  error: DatabaseError,
  fallback: string,
  overrides: Record<string, string> = {},
): string {
  if (error?.code === 'P0001' && error.message) {
    return overrides[error.message] ?? DATABASE_MESSAGES[error.message] ?? fallback
  }
  return fallback
}

/** La grille est chez l'utilisateur : il l'a creee, ou il la suit. */
function follows(grid: Grid): boolean {
  return grid.owned || grid.follow !== null
}

/**
 * Plafond et version jouable d'un utilisateur, calcules depuis son historique.
 *
 * Toujours cote serveur : un plafond envoye par le client laisserait chacun
 * ouvrir au salon des niveaux qu'il n'a jamais atteints.
 */
async function playerStanding(grid: Grid) {
  const progress = gridProgress(grid, await loadLevelOutcomes(grid.id))
  if (!progress) return null
  return { versionId: progress.version.id, ceiling: memberCeiling(progress) }
}

/**
 * Ouvre un salon sur une grille que l'on joue.
 *
 * Le salon fige la version jouable de l'hote, et l'hote en est le premier
 * membre : son plafond compte comme celui des autres. Les deux naissent
 * ensemble, par create_room, qui rejoue les controles de lecture de la grille.
 */
export async function createRoom(gridId: string): Promise<CreateRoomResult> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { roomId: null, error: SESSION_EXPIRED }

  const grid = await loadGrid(gridId)
  if (!grid || !follows(grid)) {
    return { roomId: null, error: "Cette grille n'est pas chez toi." }
  }

  const standing = await playerStanding(grid)
  if (!standing) {
    return { roomId: null, error: "Cette grille n'a aucune version jouable." }
  }

  // Salon et inscription de l'hote en une seule transaction : un echec a
  // mi-chemin laissait un salon sans membre, dont l'hote ne pouvait rien faire.
  const { data: roomId, error } = await supabase.rpc('create_room', {
    p_grid: gridId,
    p_version: standing.versionId,
    p_ceiling: standing.ceiling,
  })

  if (error || !roomId) {
    logSupabaseError('createRoom', error)
    return {
      roomId: null,
      error: databaseMessage(error, "Le salon n'a pas pu être ouvert."),
    }
  }

  return { roomId, error: null }
}

/**
 * Entre dans un salon, ou y revient.
 *
 * Un membre deja inscrit revient sans rien ecrire, salon lance ou non. Les
 * autres sont confrontes aux regles d'entree avant l'insertion ; le trigger
 * les rejoue sous verrou, et c'est lui qui tranche quand deux entrees se
 * croisent.
 */
export async function joinRoom(roomId: string): Promise<JoinRoomResult> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: SESSION_EXPIRED, refusal: 'unknown' }

  // Le salon ne se lit en entier que par son hote et ses membres. Pour les
  // autres, il est null : seule la porte, room_entry, leur repond.
  const room = await loadRoom(roomId)
  if (room?.members.some((member) => member.userId === user.id)) {
    return { error: null, refusal: null }
  }

  const entry = await loadRoomEntry(roomId)
  const grid = entry ? await loadGrid(entry.gridId) : null
  if (!entry || !grid) {
    return {
      error: "Ce salon n'existe pas, ou tu n'y as pas accès.",
      refusal: 'not_found',
    }
  }

  const standing = await playerStanding(grid)
  const refusal = joinRefusal({
    userId: user.id,
    room: {
      status: entry.status,
      gridVersionId: entry.gridVersionId,
      // Vide pour un non-membre : la RLS ne lui montre personne. Le compte
      // des places revient alors au trigger d'entree.
      members: room?.members ?? [],
    },
    follows: follows(grid),
    playableVersionId: standing?.versionId ?? null,
  })

  if (refusal === 'not_following') {
    // La page a besoin de la grille pour proposer de l'adopter.
    return { error: REFUSAL_MESSAGES[refusal], refusal, gridId: entry.gridId }
  }
  if (refusal) return { error: REFUSAL_MESSAGES[refusal], refusal }
  // joinRefusal a deja refuse une version absente : standing est renseigne.
  if (!standing) return { error: REFUSAL_MESSAGES.version, refusal: 'version' }

  const { error } = await supabase.from('session_room_members').insert({
    room_id: roomId,
    user_id: user.id,
    level_ceiling: standing.ceiling,
  })

  // Cle deja prise : un autre onglet du meme compte est entre a l'instant.
  // C'est un seul participant, et il est dans le salon.
  if (error?.code === '23505') return { error: null, refusal: null }

  if (error) {
    logSupabaseError('joinRoom', error)
    return {
      error: databaseMessage(error, "Tu n'as pas pu entrer dans le salon."),
      refusal: (error.code === 'P0001' && REFUSAL_BY_CODE[error.message]) || 'unknown',
    }
  }

  return { error: null, refusal: null }
}

/**
 * Sort d'un salon encore ouvert.
 *
 * Une fois lance, la RLS ne laisse plus rien supprimer : la ligne reste, c'est
 * elle qui autorise le retour. La suppression ne rend alors aucune ligne, et
 * c'est a cela qu'on le reconnait.
 */
export async function leaveRoom(roomId: string): Promise<RoomActionResult> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: SESSION_EXPIRED }

  const { data, error } = await supabase
    .from('session_room_members')
    .delete()
    .eq('room_id', roomId)
    .eq('user_id', user.id)
    .select('room_id')

  if (error) {
    logSupabaseError('leaveRoom', error)
    return { error: "Tu n'as pas pu quitter le salon." }
  }

  if (!data || data.length === 0) {
    return { error: 'La séance est lancée : tu ne peux plus quitter le salon.' }
  }

  return { error: null }
}

/**
 * Lance la seance sur un niveau.
 *
 * Tout se verifie dans start_room, sous verrou : hote, salon ouvert, niveau de
 * la version figee, plafond relu au moment meme. L'interface ne propose que
 * des niveaux permis, mais un participant a pu entrer entre-temps.
 */
export async function startRoom(
  roomId: string,
  levelId: string,
): Promise<RoomActionResult> {
  const supabase = await createClient()

  const { error } = await supabase.rpc('start_room', { p_room: roomId, p_level: levelId })

  if (error) {
    logSupabaseError('startRoom', error)
    return { error: databaseMessage(error, "La séance n'a pas pu être lancée.") }
  }

  return { error: null }
}

/**
 * Declare le statut de sa serie, celle du curseur du salon.
 *
 * Le statut seul, jamais la valeur : les autres voient qui a reussi, pas
 * combien il a fait. Une correction du chrono redeclare la meme serie tant
 * que le groupe ne l'a pas depassee ; ensuite, la base la refuse, et le
 * client la compte echouee de lui-meme.
 */
export async function declareSet(
  roomId: string,
  cursor: number,
  status: SetStatus,
): Promise<RoomStepResult> {
  const supabase = await createClient()

  const { error } = await supabase.rpc('declare_set', {
    p_room: roomId,
    p_cursor: cursor,
    p_status: status,
  })

  if (!error) return { error: null, stale: false }
  if (isStale(error)) return { error: null, stale: true }

  logSupabaseError('declareSet', error)
  return {
    error: databaseMessage(error, "Ta série n'a pas pu être déclarée."),
    stale: false,
  }
}

/**
 * Fait passer le groupe a l'etape suivante, chez l'hote.
 *
 * L'hote annonce l'etape qu'il croit courante et les presents qu'il voit ;
 * advance_room tranche sous verrou. Un salon deja avance -- double tap,
 * second onglet -- n'est pas une erreur : l'etat retenu est deja en route.
 */
export async function advanceRoom(
  roomId: string,
  expectedCursor: number,
  expectedStage: RoomStage,
  presentIds: string[],
  force: boolean,
): Promise<RoomStepResult> {
  const supabase = await createClient()

  const { error } = await supabase.rpc('advance_room', {
    p_room: roomId,
    p_expected_cursor: expectedCursor,
    p_expected_stage: expectedStage,
    p_present: presentIds,
    p_force: force,
  })

  if (!error) return { error: null, stale: false }
  if (isStale(error)) return { error: null, stale: true }

  logSupabaseError('advanceRoom', error)
  return {
    error: databaseMessage(error, "Le groupe n'a pas pu avancer.", {
      not_room_host: "Seul l'hôte fait avancer le groupe.",
    }),
    stale: false,
  }
}

/**
 * Battement de l'hote : il se manifeste au salon, qui le tient pour vivant.
 *
 * `deposed` : un autre membre a pris la main pendant une coupure. L'ancien
 * hote l'apprend ici, cesse de battre et redevient invite. Un battement
 * perdu en route ne dit rien de tel : le suivant partira a son heure.
 */
export async function heartbeatRoom(roomId: string): Promise<HeartbeatResult> {
  const supabase = await createClient()

  const { error } = await supabase.rpc('heartbeat_room', { p_room: roomId })

  if (!error) return { deposed: false }
  if (error.code === 'P0001' && error.message === 'not_room_host') {
    return { deposed: true }
  }

  logSupabaseError('heartbeatRoom', error)
  return { deposed: false }
}

/**
 * Prend la main d'un hote silencieux.
 *
 * claim_room_host tranche sous verrou : un hote encore vivant garde sa place,
 * et de deux candidats simultanes un seul passe. Ces deux refus ne sont pas
 * des erreurs a montrer -- quelqu'un tient le salon, c'est tout ce qui compte.
 */
export async function claimRoomHost(roomId: string): Promise<ClaimHostResult> {
  const supabase = await createClient()

  const { error } = await supabase.rpc('claim_room_host', { p_room: roomId })

  if (!error) return { claimed: true, error: null }
  if (error.code === 'P0001' && CLAIM_SILENT_CODES.has(error.message ?? '')) {
    return { claimed: false, error: null }
  }

  logSupabaseError('claimRoomHost', error)
  return {
    claimed: false,
    error: databaseMessage(error, "Tu n'as pas pu prendre la main."),
  }
}
