'use server'

import { revalidatePath } from 'next/cache'

import { isValidWarningPercent } from '@/lib/account/preferences'
import { validateDisplayName, validatePasswordChange } from '@/lib/account/validation'
import { createClient } from '@/lib/supabase/server'

import type { AccountState } from './account-state'

/** Met a jour le nom affiche du profil. */
export async function updateDisplayName(
  _prev: AccountState,
  formData: FormData,
): Promise<AccountState> {
  const displayName = String(formData.get('displayName') ?? '').trim()

  const issue = validateDisplayName(displayName)
  if (issue) return { error: issue, notice: null }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Session expirée. Reconnecte-toi.', notice: null }

  const { error } = await supabase
    .from('profiles')
    // Vide vaut null : l'application retombe alors sur l'adresse, plutot que
    // d'afficher une chaine vide la ou elle attend un nom.
    .update({ display_name: displayName || null })
    .eq('id', user.id)

  if (error) return { error: "Le nom affiché n'a pas pu être enregistré.", notice: null }

  revalidatePath('/compte')
  return { error: null, notice: 'Nom affiché enregistré.' }
}

/**
 * Change le mot de passe.
 *
 * Le mot de passe actuel est verifie en rejouant une connexion : Supabase ne
 * le demande pas pour `updateUser`, et sans cette verification une session
 * laissee ouverte sur un poste partage suffirait a prendre le compte.
 */
export async function updatePassword(
  _prev: AccountState,
  formData: FormData,
): Promise<AccountState> {
  const change = {
    current: String(formData.get('currentPassword') ?? ''),
    next: String(formData.get('newPassword') ?? ''),
    confirmation: String(formData.get('confirmation') ?? ''),
  }

  const issue = validatePasswordChange(change)
  if (issue) return { error: issue, notice: null }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) return { error: 'Session expirée. Reconnecte-toi.', notice: null }

  const identities = user.identities ?? []
  if (!identities.some((identity) => identity.provider === 'email')) {
    return {
      error:
        "Ce compte se connecte par un fournisseur externe : il n'a pas de mot de passe ici.",
      notice: null,
    }
  }

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: change.current,
  })

  if (signInError) {
    // Supabase limite le debit des connexions : au-dela, l'echec ne dit plus
    // rien du mot de passe saisi, et annoncer « incorrect » enverrait
    // l'utilisateur chercher une faute qui n'existe pas.
    if (signInError.status === 429) {
      return {
        error: 'Trop de tentatives. Réessaie dans quelques minutes.',
        notice: null,
      }
    }
    return { error: 'Mot de passe actuel incorrect.', notice: null }
  }

  const { error } = await supabase.auth.updateUser({ password: change.next })
  if (error) {
    return { error: "Le mot de passe n'a pas pu être changé.", notice: null }
  }

  return { error: null, notice: 'Mot de passe changé.' }
}

/**
 * Enregistre les reperes du chrono.
 *
 * Les trois canaux arrivent en cases a cocher : absentes du FormData quand
 * elles sont decochees, d'ou la lecture par presence plutot que par valeur.
 */
export async function updateTimerCues(
  _prev: AccountState,
  formData: FormData,
): Promise<AccountState> {
  const warningPercent = Number(formData.get('warningPercent'))

  if (!isValidWarningPercent(warningPercent)) {
    return { error: "La fenêtre d'annonce est hors bornes.", notice: null }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Session expirée. Reconnecte-toi.', notice: null }

  const { error } = await supabase
    .from('profiles')
    .update({
      timer_sound: formData.get('sound') !== null,
      timer_blink: formData.get('blink') !== null,
      timer_flash: formData.get('flash') !== null,
      timer_warning_percent: warningPercent,
    })
    .eq('id', user.id)

  if (error) {
    return { error: "Les repères n'ont pas pu être enregistrés.", notice: null }
  }

  revalidatePath('/compte')
  return { error: null, notice: 'Repères enregistrés.' }
}
