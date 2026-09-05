/**
 * Variables d'environnement, validees au chargement du module.
 *
 * Les references a `process.env.X` sont ecrites en toutes lettres : Next
 * substitue ces expressions a la compilation pour les injecter dans le bundle
 * client. Un acces dynamique (`process.env[nom]`) ne serait pas substitue et
 * vaudrait `undefined` dans le navigateur.
 */

function required(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(
      `Variable d'environnement manquante : ${name}. ` +
        `Renseigne-la dans .env.local (voir .env.example).`,
    )
  }
  return value
}

export const env = {
  supabaseUrl: required(process.env.NEXT_PUBLIC_SUPABASE_URL, 'NEXT_PUBLIC_SUPABASE_URL'),
  supabasePublishableKey: required(
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  ),
} as const
