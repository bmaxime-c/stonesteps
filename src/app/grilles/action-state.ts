/**
 * Etat renvoye par les actions de l'editeur.
 *
 * Hors de actions.ts, comme pour l'authentification : un fichier "use server"
 * ne peut exporter que des fonctions asynchrones.
 */
export type ActionState = { error: string | null; notice: string | null }

export const emptyActionState: ActionState = { error: null, notice: null }
