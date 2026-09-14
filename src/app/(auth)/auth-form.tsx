'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

import { emptyAuthState, type AuthState } from './auth-state'

type AuthAction = (state: AuthState, formData: FormData) => Promise<AuthState>

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      {pending ? 'Un instant…' : label}
    </Button>
  )
}

export function AuthForm({
  action,
  mode,
  redirectTo,
  initialError,
}: {
  action: AuthAction
  mode: 'signin' | 'signup'
  redirectTo?: string
  initialError?: string
}) {
  const [state, formAction] = useActionState(action, {
    ...emptyAuthState,
    error: initialError ?? null,
  })

  const isSignUp = mode === 'signup'

  return (
    <form action={formAction} className="space-y-4">
      {redirectTo ? <input type="hidden" name="redirectTo" value={redirectTo} /> : null}

      {state.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      {state.notice ? (
        <Alert>
          <AlertDescription>{state.notice}</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="email">Adresse e-mail</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
        />
      </div>

      {isSignUp ? (
        <div className="space-y-2">
          <Label htmlFor="displayName">Nom affiche</Label>
          <Input
            id="displayName"
            name="displayName"
            type="text"
            autoComplete="name"
            maxLength={40}
          />
          <p className="text-tertiary text-xs">
            Facultatif. A defaut, ton adresse e-mail en tient lieu.
          </p>
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="password">Mot de passe</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete={isSignUp ? 'new-password' : 'current-password'}
          minLength={isSignUp ? 8 : undefined}
          required
        />
      </div>

      <SubmitButton label={isSignUp ? 'Creer mon compte' : 'Se connecter'} />
    </form>
  )
}
