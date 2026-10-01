'use server'

import { revalidatePath } from 'next/cache'

import { loadRoom } from '@/lib/session/group/queries'
import { isLevelValidated } from '@/lib/session/level'
import type { ConsolidateInput, ConsolidateResult } from '@/lib/session/model'
import { createClient } from '@/lib/supabase/server'

type SupabaseServer = Awaited<ReturnType<typeof createClient>>

const NOT_A_MEMBER = 'Tu ne fais pas partie de ce salon.'
const NOT_THE_ROOM_LEVEL = "Ce niveau n'est pas celui du salon."

/**
 * Controle d'une seance jouee dans un salon : le numero de niveau a ranger,
 * ou le refus.
 *
 * Trois verifications, toutes cote serveur, parce que le client pourrait
 * pretendre n'importe quoi : l'utilisateur est membre du salon, le niveau
 * enregistre est celui que le salon a lance, et ce niveau ne depasse pas le
 * plafond calcule a son entree. Sans la derniere, un participant entre sur un
 * niveau facile pourrait se faire valider un niveau qu'il n'a jamais atteint.
 *
 * Le niveau se lit sur la version figee du salon : une publication pendant la
 * seance ne doit faire rejeter aucun resultat. Son numero vient de la base,
 * pas de ce que le client a affiche.
 */
async function roomLevelNumber(
  supabase: SupabaseServer,
  userId: string,
  input: ConsolidateInput & { roomId: string },
): Promise<{ levelNumber: number; error: null } | { levelNumber: null; error: string }> {
  // La RLS rend null a qui n'est ni hote ni membre : meme refus dans les deux cas.
  const room = await loadRoom(input.roomId)
  const member = room?.members.find((candidate) => candidate.userId === userId)
  if (!room || !member) return { levelNumber: null, error: NOT_A_MEMBER }

  if (
    room.levelId === null ||
    room.levelId !== input.levelId ||
    room.gridId !== input.gridId
  ) {
    return { levelNumber: null, error: NOT_THE_ROOM_LEVEL }
  }

  const { data: level } = await supabase
    .from('levels')
    .select('position, grid_version_id')
    .eq('id', room.levelId)
    .maybeSingle()

  if (!level || level.grid_version_id !== room.gridVersionId) {
    return { levelNumber: null, error: NOT_THE_ROOM_LEVEL }
  }

  if (level.position > member.levelCeiling) {
    return {
      levelNumber: null,
      error:
        'Ce niveau dépasse ton niveau en cours : la séance ne peut pas être enregistrée.',
    }
  }

  return { levelNumber: level.position, error: null }
}

/**
 * Consolidation d'une seance terminee.
 *
 * Une seule ecriture en base, a la fin : la seance se joue cote client, et une
 * seance interrompue n'est pas sauvegardee.
 *
 * L'atomicite passe par `completed_at`, renseigne en dernier. Une seance dont
 * les series n'ont pas fini de s'ecrire reste `completed_at is null`, et les
 * requetes qui lisent l'historique l'ignorent : jamais de verdict de niveau
 * calcule sur des series a moitie enregistrees. Si l'insertion des series
 * echoue, la ligne de seance est retiree dans la foulee.
 *
 * Le verdict est recalcule ici a partir des resultats : c'est le serveur qui
 * tranche, pas le booleen que le client a bien voulu envoyer.
 *
 * Une seance de groupe porte en plus `roomId` : elle s'enregistre comme une
 * seance solo, a soi, une fois controlee contre le salon. Un niveau inferieur
 * au niveau en cours entre dans l'historique sans toucher a la progression,
 * qui ne retient que le premier niveau sans seance validee.
 */
export async function consolidateSession(
  input: ConsolidateInput,
): Promise<ConsolidateResult> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { sessionId: null, error: 'Session expirée. Reconnecte-toi.' }

  if (input.results.length === 0) {
    return { sessionId: null, error: 'Aucune série à enregistrer.' }
  }

  let levelNumber = input.levelNumber
  if (input.roomId !== undefined) {
    const checked = await roomLevelNumber(supabase, user.id, {
      ...input,
      roomId: input.roomId,
    })
    if (checked.error !== null) return { sessionId: null, error: checked.error }
    levelNumber = checked.levelNumber
  }

  const validated = isLevelValidated(input.results)

  const { data: session, error: sessionError } = await supabase
    .from('sessions')
    .insert({
      owner_id: user.id,
      grid_id: input.gridId,
      level_id: input.levelId,
      grid_name: input.gridName,
      grid_version: input.gridVersion,
      level_number: levelNumber,
      started_at: input.startedAt,
      validated,
    })
    .select('id')
    .single()

  if (sessionError || !session) {
    return { sessionId: null, error: "La séance n'a pas pu être enregistrée." }
  }

  const { error: setsError } = await supabase.from('session_sets').insert(
    input.results.map((result) => ({
      session_id: session.id,
      level_set_id: result.levelSetId,
      set_index: result.setIndex,
      exercise_name: result.exerciseName,
      set_label: result.setLabel,
      unit: result.unit,
      target_value: result.targetValue,
      actual_value: result.actualValue,
      status: result.status,
    })),
  )

  if (setsError) {
    // Compensation : mieux vaut aucune seance qu'une seance amputee de ses
    // series, qui fausserait le verdict comme les statistiques.
    await supabase.from('sessions').delete().eq('id', session.id)
    return { sessionId: null, error: "Les séries n'ont pas pu être enregistrées." }
  }

  const { error: completeError } = await supabase
    .from('sessions')
    .update({ completed_at: new Date().toISOString() })
    .eq('id', session.id)

  if (completeError) {
    await supabase.from('session_sets').delete().eq('session_id', session.id)
    await supabase.from('sessions').delete().eq('id', session.id)
    return { sessionId: null, error: "La séance n'a pas pu être clôturée." }
  }

  revalidatePath('/')
  revalidatePath('/stats')

  return { sessionId: session.id, error: null }
}
