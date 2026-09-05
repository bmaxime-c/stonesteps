import type { NextRequest } from 'next/server'

import { updateSession } from '@/lib/supabase/proxy'

// Next 16 : ce fichier remplace middleware.ts (meme mecanisme, nouveau nom).
export default async function proxy(request: NextRequest) {
  return updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Toutes les routes sauf les fichiers statiques, les images optimisees,
     * le service worker et le manifeste : la session n'y sert a rien et on
     * evite d'appeler Supabase pour chaque asset.
     */
    '/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
