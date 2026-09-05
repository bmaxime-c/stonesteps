import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

import { env } from '@/lib/env'

/**
 * Client Supabase cote serveur (Server Components, Server Actions, handlers).
 *
 * A recreer a chaque requete : il porte les cookies de session de l'appelant,
 * il ne doit donc jamais etre mis en cache dans une variable de module.
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(env.supabaseUrl, env.supabasePublishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options)
          }
        } catch {
          // Ecrire un cookie depuis un Server Component leve une exception.
          // Sans consequence : le rafraichissement de session est assure par
          // le proxy, qui s'execute avant le rendu.
        }
      },
    },
  })
}
