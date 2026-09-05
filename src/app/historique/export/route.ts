import { NextResponse } from 'next/server'

import { listSessions } from '@/lib/history/queries'
import { createClient } from '@/lib/supabase/server'

/**
 * Export des donnees personnelles.
 *
 * Utile en soi — recuperer son historique sans passer par l'application — et
 * premiere brique du droit a la portabilite, qui s'appliquera des que
 * l'application hebergera les donnees de tiers.
 *
 * Ne renvoie que les seances du membre connecte : la RLS le garantit deja,
 * `listSessions` filtre en plus sur son identifiant.
 */
export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Non authentifie' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('username, display_name, created_at')
    .eq('id', user.id)
    .single()

  const sessions = await listSessions()

  const payload = {
    exportedAt: new Date().toISOString(),
    profile: {
      username: profile?.username ?? null,
      displayName: profile?.display_name ?? null,
      createdAt: profile?.created_at ?? null,
    },
    sessions,
  }

  const date = new Date().toISOString().slice(0, 10)

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="stonesteps-${date}.json"`,
      // Des donnees personnelles n'ont rien a faire dans un cache partage.
      'Cache-Control': 'private, no-store',
    },
  })
}
