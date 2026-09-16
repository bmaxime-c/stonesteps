'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DISPLAY_NAME_MAX, PASSWORD_MIN } from '@/lib/account/validation'

import { emptyAccountState, type AccountState } from './account-state'
import { updateDisplayName, updatePassword } from './actions'

type AccountAction = (state: AccountState, formData: FormData) => Promise<AccountState>

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-primary text-primary-foreground self-start rounded-full px-5 py-2.5 text-sm font-bold disabled:opacity-50"
    >
      {pending ? 'Un instant…' : label}
    </button>
  )
}

/** Retour d'action, sous le formulaire qui l'a produit. */
export function Feedback({ state }: { state: AccountState }) {
  if (state.error) {
    return (
      <p
        role="alert"
        className="border-fail/40 bg-fail/10 rounded-[14px] border px-4 py-3 text-sm font-semibold"
      >
        {state.error}
      </p>
    )
  }

  if (state.notice) {
    return (
      <p
        role="status"
        className="border-success/40 bg-success/10 rounded-[14px] border px-4 py-3 text-sm font-semibold"
      >
        {state.notice}
      </p>
    )
  }

  return null
}

export function DisplayNameForm({ displayName }: { displayName: string }) {
  const [state, formAction] = useActionState<AccountState, FormData>(
    updateDisplayName as AccountAction,
    emptyAccountState,
  )

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Feedback state={state} />

      <div className="space-y-2">
        <Label htmlFor="displayName">Nom affiché</Label>
        <Input
          id="displayName"
          name="displayName"
          type="text"
          autoComplete="name"
          maxLength={DISPLAY_NAME_MAX}
          defaultValue={displayName}
        />
        <p className="text-tertiary text-xs">
          Facultatif. À défaut, ton adresse e-mail en tient lieu.
        </p>
      </div>

      <SubmitButton label="Enregistrer" />
    </form>
  )
}

export function PasswordForm() {
  const [state, formAction] = useActionState<AccountState, FormData>(
    updatePassword as AccountAction,
    emptyAccountState,
  )

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Feedback state={state} />

      <div className="space-y-2">
        <Label htmlFor="currentPassword">Mot de passe actuel</Label>
        <Input
          id="currentPassword"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="newPassword">Nouveau mot de passe</Label>
        <Input
          id="newPassword"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          minLength={PASSWORD_MIN}
          required
        />
        <p className="text-tertiary text-xs">Au moins {PASSWORD_MIN} caractères.</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmation">Confirmation</Label>
        <Input
          id="confirmation"
          name="confirmation"
          type="password"
          autoComplete="new-password"
          minLength={PASSWORD_MIN}
          required
        />
      </div>

      <SubmitButton label="Changer le mot de passe" />
    </form>
  )
}
