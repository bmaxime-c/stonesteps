/**
 * Regles de saisie de la page « Mon compte ».
 *
 * Elles vivent ici plutot que dans les actions parce qu'elles se testent, et
 * parce que le formulaire et le serveur doivent dire exactement la meme chose :
 * une regle recopiee des deux cotes finit toujours par diverger.
 */

export const DISPLAY_NAME_MAX = 40
export const PASSWORD_MIN = 8

/**
 * Nom affiche.
 *
 * Facultatif : vide, il laisse l'application retomber sur la partie locale de
 * l'adresse, comme a l'inscription.
 */
export function validateDisplayName(value: string): string | null {
  if (value.trim().length > DISPLAY_NAME_MAX) {
    return `Le nom affiché ne dépasse pas ${DISPLAY_NAME_MAX} caractères.`
  }
  return null
}

export type PasswordChange = {
  current: string
  next: string
  confirmation: string
}

/**
 * Changement de mot de passe.
 *
 * Le mot de passe actuel est demandé et vérifié côté serveur : sans lui, une
 * session laissée ouverte sur un poste partagé suffirait à prendre le compte.
 */
export function validatePasswordChange(change: PasswordChange): string | null {
  if (!change.current) return 'Saisis ton mot de passe actuel.'

  if (change.next.length < PASSWORD_MIN) {
    return `Le nouveau mot de passe fait au moins ${PASSWORD_MIN} caractères.`
  }

  if (change.next !== change.confirmation) {
    return 'La confirmation ne correspond pas au nouveau mot de passe.'
  }

  if (change.next === change.current) {
    return 'Le nouveau mot de passe est identique à l’ancien.'
  }

  return null
}

/**
 * Le compte peut-il changer de mot de passe ?
 *
 * Seulement s'il a une identite e-mail. Un compte cree par Google n'a pas de
 * mot de passe chez nous : lui en proposer un serait un reglage sans effet sur
 * sa facon de se connecter.
 */
export function hasPasswordIdentity(providers: string[]): boolean {
  return providers.includes('email')
}
