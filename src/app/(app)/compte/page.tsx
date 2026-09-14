import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { signOut } from '@/app/(auth)/actions'
import { ScreenHeader } from '@/components/screen-header'
import { hasPasswordIdentity } from '@/lib/account/validation'
import { createClient } from '@/lib/supabase/server'

import { DisplayNameForm, PasswordForm } from './account-forms'

export const metadata: Metadata = { title: 'Mon compte' }

/** Libelle lisible d'un fournisseur d'authentification. */
const PROVIDER_LABELS: Record<string, string> = {
  email: 'e-mail et mot de passe',
  google: 'Google',
}

export default async function AccountPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Le proxy protege deja la route ; ce garde-fou sert au typage et au cas ou
  // la session expire entre le proxy et le rendu.
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', user.id)
    .maybeSingle()

  const providers = (user.identities ?? []).map((identity) => identity.provider)
  const canChangePassword = hasPasswordIdentity(providers)

  return (
    <main className="gutter mx-auto flex w-full max-w-[720px] flex-col gap-[22px] pt-[clamp(20px,3vw,36px)] pb-[72px]">
      <ScreenHeader eyebrow="Réglages" title="Mon compte" />

      <section className="bg-card border-border flex flex-col gap-4 rounded-[20px] border p-5">
        <div>
          <h2 className="text-[15px] font-bold">Adresse e-mail</h2>
          <p className="text-tertiary mt-1 text-xs">
            Elle identifie le compte et ne se change pas ici.
          </p>
        </div>
        <p className="bg-inset border-border text-muted-foreground rounded-[14px] border px-4 py-3 text-sm">
          {user.email}
        </p>
        <p className="text-tertiary text-xs">
          Connexion par{' '}
          {providers
            .map((provider) => PROVIDER_LABELS[provider] ?? provider)
            .join(' et ')}
          .
        </p>
      </section>

      <section className="bg-card border-border flex flex-col gap-4 rounded-[20px] border p-5">
        <h2 className="text-[15px] font-bold">Nom affiché</h2>
        <DisplayNameForm displayName={profile?.display_name ?? ''} />
      </section>

      <section className="bg-card border-border flex flex-col gap-4 rounded-[20px] border p-5">
        <div>
          <h2 className="text-[15px] font-bold">Mot de passe</h2>
          {!canChangePassword ? (
            <p className="text-tertiary mt-1 text-xs">
              Ce compte se connecte par un fournisseur externe : il n&apos;a pas de mot de
              passe ici, et il n&apos;y a donc rien à changer.
            </p>
          ) : null}
        </div>
        {canChangePassword ? <PasswordForm /> : null}
      </section>

      <form action={signOut}>
        <button
          type="submit"
          className="border-border-strong text-muted-foreground w-full rounded-full border py-3.5 text-sm font-semibold"
        >
          Se déconnecter
        </button>
      </form>
    </main>
  )
}
