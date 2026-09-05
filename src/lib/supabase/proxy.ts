import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

import { env } from '@/lib/env'

/** Prefixes accessibles sans etre connecte. */
const PUBLIC_PATHS = ['/', '/login', '/signup', '/auth', '/offline']

export function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))
}

/**
 * Rafraichit la session a chaque requete et protege les routes privees.
 *
 * Deux precautions imposees par @supabase/ssr :
 *  - les cookies rafraichis doivent etre poses a la fois sur la requete (pour
 *    le rendu qui suit) et sur la reponse (pour le navigateur) ;
 *  - il faut appeler getClaims() / getUser() sans rien intercaler avant, sinon
 *    la session peut expirer de facon aleatoire.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(env.supabaseUrl, env.supabasePublishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value)
        }
        response = NextResponse.next({ request })
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options)
        }
      },
    },
  })

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user && !isPublic(request.nextUrl.pathname)) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    loginUrl.searchParams.set('redirectTo', request.nextUrl.pathname)
    return NextResponse.redirect(loginUrl)
  }

  return response
}
