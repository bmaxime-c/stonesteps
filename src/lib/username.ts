/**
 * Regles de pseudo, partagees entre le formulaire et la contrainte SQL
 * `profiles.username ~ '^[a-z0-9_-]{3,30}$'`. Les deux doivent rester alignees.
 */
export const USERNAME_PATTERN = /^[a-z0-9_-]{3,30}$/

/** Met en forme une saisie libre : minuscules, espaces en tirets, reste elague. */
export function normalizeUsername(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9_-]/g, '')
    .slice(0, 30)
}
