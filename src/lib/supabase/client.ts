import { createBrowserClient } from '@supabase/ssr'

import { env } from '@/lib/env'

/** Client Supabase pour les composants qui s'executent dans le navigateur. */
export function createClient() {
  return createBrowserClient(env.supabaseUrl, env.supabasePublishableKey)
}
