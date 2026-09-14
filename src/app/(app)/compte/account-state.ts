/**
 * Etat des formulaires de la page « Mon compte ».
 *
 * Hors de actions.ts : un module « use server » ne peut exporter que des
 * fonctions asynchrones.
 */
export type AccountState = { error: string | null; notice: string | null }

export const emptyAccountState: AccountState = { error: null, notice: null }
