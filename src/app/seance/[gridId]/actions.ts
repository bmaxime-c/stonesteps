'use server'

import { revalidatePath } from 'next/cache'

import { isLevelValidated } from '@/lib/session/level'
import type { ConsolidateInput, ConsolidateResult } from '@/lib/session/model'
import { createClient } from '@/lib/supabase/server'

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

  const validated = isLevelValidated(input.results)

  const { data: session, error: sessionError } = await supabase
    .from('sessions')
    .insert({
      owner_id: user.id,
      grid_id: input.gridId,
      level_id: input.levelId,
      grid_name: input.gridName,
      grid_version: input.gridVersion,
      level_number: input.levelNumber,
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
