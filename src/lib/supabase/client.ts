import { createBrowserClient } from '@supabase/ssr'

import type { Database } from '@/lib/database.types'
import { env } from '@/lib/env'

/** Client Supabase pour les composants qui s'executent dans le navigateur. */
export function createClient() {
  return createBrowserClient<Database>(env.supabaseUrl, env.supabasePublishableKey)
}
