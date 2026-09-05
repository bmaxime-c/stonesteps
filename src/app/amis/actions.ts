'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'

async function requireUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  return { supabase, user }
}

function refresh() {
  revalidatePath('/amis')
  revalidatePath('/dashboard')
}

export async function sendFriendRequest(formData: FormData): Promise<void> {
  const addresseeId = String(formData.get('personId') ?? '')
  const { supabase, user } = await requireUser()

  if (!addresseeId || addresseeId === user.id) return

  const { error } = await supabase
    .from('friendships')
    .insert({ requester_id: user.id, addressee_id: addresseeId, status: 'pending' })

  // Une demande deja existante n'est pas une erreur a remonter : le bouton a
  // simplement ete presse deux fois, ou l'autre partie a demande la premiere.
  if (error && error.code !== '23505') throw error

  refresh()
}

export async function acceptFriendRequest(formData: FormData): Promise<void> {
  const requesterId = String(formData.get('personId') ?? '')
  const { supabase, user } = await requireUser()

  // Le declencheur en base verifie aussi que seul le destinataire accepte :
  // ce filtre-ci n'est qu'un raccourci, pas la garantie.
  const { error } = await supabase
    .from('friendships')
    .update({ status: 'accepted' })
    .eq('requester_id', requesterId)
    .eq('addressee_id', user.id)

  if (error) throw error

  refresh()
}

export async function removeFriendship(formData: FormData): Promise<void> {
  const personId = String(formData.get('personId') ?? '')
  const { supabase, user } = await requireUser()

  // Supprime la ligne quel que soit le sens de la demande d'origine.
  const { error } = await supabase
    .from('friendships')
    .delete()
    .or(
      `and(requester_id.eq.${user.id},addressee_id.eq.${personId}),` +
        `and(requester_id.eq.${personId},addressee_id.eq.${user.id})`,
    )

  if (error) throw error

  refresh()
}

export async function blockPerson(formData: FormData): Promise<void> {
  const personId = String(formData.get('personId') ?? '')
  const { supabase, user } = await requireUser()

  const { error: deleteError } = await supabase
    .from('friendships')
    .delete()
    .or(
      `and(requester_id.eq.${user.id},addressee_id.eq.${personId}),` +
        `and(requester_id.eq.${personId},addressee_id.eq.${user.id})`,
    )

  if (deleteError) throw deleteError

  // Recree la ligne dans le sens du bloqueur : c'est lui qui la controle.
  const { error } = await supabase
    .from('friendships')
    .insert({ requester_id: user.id, addressee_id: personId, status: 'blocked' })

  if (error) throw error

  refresh()
}
