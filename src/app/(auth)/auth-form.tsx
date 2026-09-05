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
    <Button type="submit" className="w-full" disabled={pending}>
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
          <Label htmlFor="username">Pseudo</Label>
          <Input
            id="username"
            name="username"
            type="text"
            autoComplete="username"
            pattern="[a-zA-Z0-9_\- ]{3,30}"
            required
          />
          <p className="text-muted-foreground text-xs">
            3 a 30 caracteres. Il servira a tes amis pour te retrouver.
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
