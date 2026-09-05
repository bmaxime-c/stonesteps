'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import { USERNAME_PATTERN, normalizeUsername } from '@/lib/username'

import type { AuthState } from './auth-state'

/** Traduit les messages d'erreur Supabase, qui sont en anglais. */
function translate(message: string): string {
  const known: Record<string, string> = {
    'Invalid login credentials': 'Identifiants incorrects.',
    'Email not confirmed':
      'Adresse non confirmee. Ouvre le lien recu par e-mail avant de te connecter.',
    'User already registered': 'Un compte existe deja avec cette adresse.',
    'Password should be at least 6 characters':
      'Le mot de passe doit faire au moins 6 caracteres.',
  }
  return known[message] ?? message
}

/** URL absolue du site, deduite des en-tetes : marche en local comme sur Vercel. */
async function siteUrl(): Promise<string> {
  const headerList = await headers()
  const host = headerList.get('x-forwarded-host') ?? headerList.get('host')
  const protocol = headerList.get('x-forwarded-proto') ?? 'http'
  return `${protocol}://${host}`
}

function safeRedirectTo(value: FormDataEntryValue | null): string {
  const target = typeof value === 'string' ? value : ''
  // Uniquement des chemins internes : evite une redirection ouverte.
  return target.startsWith('/') && !target.startsWith('//') ? target : '/dashboard'
}

export async function signIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')
  const redirectTo = safeRedirectTo(formData.get('redirectTo'))

  if (!email || !password) {
    return { error: 'Adresse e-mail et mot de passe sont requis.', notice: null }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return { error: translate(error.message), notice: null }
  }

  revalidatePath('/', 'layout')
  redirect(redirectTo)
}

export async function signUp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')
  const username = normalizeUsername(String(formData.get('username') ?? ''))

  if (!email || !password || !username) {
    return {
      error: 'Adresse e-mail, pseudo et mot de passe sont requis.',
      notice: null,
    }
  }

  if (!USERNAME_PATTERN.test(username)) {
    return {
      error:
        'Le pseudo doit faire 3 a 30 caracteres, en minuscules, chiffres, tiret ou underscore.',
      notice: null,
    }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { username },
      emailRedirectTo: `${await siteUrl()}/auth/callback`,
    },
  })

  if (error) {
    return { error: translate(error.message), notice: null }
  }

  return {
    error: null,
    notice:
      'Compte cree. Ouvre le lien de confirmation envoye a ton adresse pour activer la connexion.',
  }
}

export async function signInWithGoogle(): Promise<void> {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${await siteUrl()}/auth/callback` },
  })

  if (error || !data.url) {
    redirect(`/login?error=${encodeURIComponent(error?.message ?? 'oauth')}`)
  }

  redirect(data.url)
}

export async function signOut(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/login')
}
