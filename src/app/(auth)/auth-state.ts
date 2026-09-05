/**
 * Etat des formulaires d'authentification.
 *
 * Volontairement hors de actions.ts : un fichier "use server" ne peut exporter
 * que des fonctions asynchrones, jamais une valeur comme `emptyAuthState`.
 */
export type AuthState = { error: string | null; notice: string | null }

export const emptyAuthState: AuthState = { error: null, notice: null }
