import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { AccountState } from './account-state'
import { DisplayNameForm, PasswordForm } from './account-forms'

const nameAction = vi.fn(
  async (_prev: AccountState, _formData: FormData): Promise<AccountState> => ({
    error: null,
    notice: 'Nom affiché enregistré.',
  }),
)
const passwordAction = vi.fn(
  async (_prev: AccountState, _formData: FormData): Promise<AccountState> => ({
    error: null,
    notice: 'Mot de passe changé.',
  }),
)

vi.mock('./actions', () => ({
  updateDisplayName: (prev: AccountState, formData: FormData) =>
    nameAction(prev, formData),
  updatePassword: (prev: AccountState, formData: FormData) =>
    passwordAction(prev, formData),
}))

beforeEach(() => {
  nameAction.mockClear()
  passwordAction.mockClear()
})

describe('nom affiché', () => {
  it('part de la valeur enregistrée', () => {
    render(<DisplayNameForm displayName="Maxime" />)
    expect(screen.getByLabelText('Nom affiché')).toHaveValue('Maxime')
  })

  it('rappelle que le champ est facultatif', () => {
    render(<DisplayNameForm displayName="" />)
    expect(
      screen.getByText('Facultatif. À défaut, ton adresse e-mail en tient lieu.'),
    ).toBeInTheDocument()
  })

  it('envoie la saisie et confirme', async () => {
    const user = userEvent.setup()
    render(<DisplayNameForm displayName="" />)

    await user.type(screen.getByLabelText('Nom affiché'), 'Maxime')
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }))

    expect(nameAction).toHaveBeenCalledTimes(1)
    expect(nameAction.mock.calls[0][1].get('displayName')).toBe('Maxime')
    expect(await screen.findByRole('status')).toHaveTextContent('Nom affiché enregistré.')
  })

  it('affiche l erreur remontée par le serveur', async () => {
    nameAction.mockResolvedValueOnce({
      error: 'Le nom affiché ne dépasse pas 40 caractères.',
      notice: null,
    })

    const user = userEvent.setup()
    render(<DisplayNameForm displayName="" />)
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Le nom affiché ne dépasse pas 40 caractères.',
    )
  })
})

describe('mot de passe', () => {
  it('demande l actuel, le nouveau et sa confirmation', () => {
    render(<PasswordForm />)
    expect(screen.getByLabelText('Mot de passe actuel')).toBeRequired()
    expect(screen.getByLabelText('Nouveau mot de passe')).toBeRequired()
    expect(screen.getByLabelText('Confirmation')).toBeRequired()
  })

  it('annonce la longueur minimale', () => {
    render(<PasswordForm />)
    expect(screen.getByText('Au moins 8 caractères.')).toBeInTheDocument()
    expect(screen.getByLabelText('Nouveau mot de passe')).toHaveAttribute(
      'minlength',
      '8',
    )
  })

  it('transmet les trois champs au serveur', async () => {
    const user = userEvent.setup()
    render(<PasswordForm />)

    await user.type(screen.getByLabelText('Mot de passe actuel'), 'ancien-secret')
    await user.type(screen.getByLabelText('Nouveau mot de passe'), 'nouveau-secret')
    await user.type(screen.getByLabelText('Confirmation'), 'nouveau-secret')
    await user.click(screen.getByRole('button', { name: 'Changer le mot de passe' }))

    const formData = passwordAction.mock.calls[0][1]
    expect(formData.get('currentPassword')).toBe('ancien-secret')
    expect(formData.get('newPassword')).toBe('nouveau-secret')
    expect(formData.get('confirmation')).toBe('nouveau-secret')
    expect(await screen.findByRole('status')).toHaveTextContent('Mot de passe changé.')
  })

  it('affiche le refus quand le mot de passe actuel est faux', async () => {
    passwordAction.mockResolvedValueOnce({
      error: 'Mot de passe actuel incorrect.',
      notice: null,
    })

    const user = userEvent.setup()
    render(<PasswordForm />)

    await user.type(screen.getByLabelText('Mot de passe actuel'), 'faux')
    await user.type(screen.getByLabelText('Nouveau mot de passe'), 'nouveau-secret')
    await user.type(screen.getByLabelText('Confirmation'), 'nouveau-secret')
    await user.click(screen.getByRole('button', { name: 'Changer le mot de passe' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Mot de passe actuel incorrect.',
    )
  })
})
