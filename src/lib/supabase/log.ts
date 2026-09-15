import 'server-only'

/**
 * Trace une erreur Supabase cote serveur.
 *
 * Les lectures retombent sur une liste vide et les actions sur un libelle
 * generique : c'est ce qu'il faut montrer a l'utilisateur, mais ca ne laisse
 * rien pour diagnostiquer. Le detail PostgREST — code, message, indice — part
 * donc dans les logs du serveur, ou il ne gene personne.
 */
export function logSupabaseError(context: string, error: unknown): void {
  if (!error) return
  const detail = error as {
    code?: string
    message?: string
    details?: string
    hint?: string
  }
  console.error('[supabase]', context, {
    code: detail.code,
    message: detail.message,
    details: detail.details,
    hint: detail.hint,
  })
}
