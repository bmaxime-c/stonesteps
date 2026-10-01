import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Room, RoomMember } from '@/lib/session/group/model'

import { OpenRoomButton } from '../open-room-button'
import { Lobby } from './lobby'
import { AdoptToJoin, RoomRefusal } from './refusal'

const live = vi.hoisted(() => ({ present: new Set<string>() }))

const actions = vi.hoisted(() => ({
  createRoom: vi.fn(),
  leaveRoom: vi.fn(),
  startRoom: vi.fn(),
  followGrid: vi.fn(),
}))

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }))

vi.mock('next/navigation', () => ({ useRouter: () => router }))

// Le salon en direct est teste a part : ici, il rend le salon tel quel.
vi.mock('@/lib/session/group/use-room', () => ({
  useRoom: (initial: Room) => ({ room: initial, presentIds: live.present }),
}))

vi.mock('../actions', () => ({
  createRoom: actions.createRoom,
  leaveRoom: actions.leaveRoom,
  startRoom: actions.startRoom,
}))

vi.mock('@/app/(app)/grilles/actions', () => ({
  followGrid: actions.followGrid,
  unfollowGrid: vi.fn(),
  duplicateGrid: vi.fn(),
}))

function member(userId: string, name: string, levelCeiling: number): RoomMember {
  return {
    userId,
    displayName: name,
    levelCeiling,
    declaredCursor: -1,
    lastStatus: null,
    joinedAt: `2026-10-01T10:0${userId === 'host' ? 0 : 1}:00Z`,
  }
}

function room(overrides: Partial<Room> = {}): Room {
  return {
    id: 'room-1',
    gridId: 'grid-1',
    gridVersionId: 'v1',
    hostId: 'host',
    levelId: null,
    status: 'open',
    cursor: 0,
    stage: 'set',
    restStartedAt: null,
    members: [member('host', 'Alice', 4), member('guest', 'Bruno', 2)],
    ...overrides,
  }
}

const levels = [1, 2, 3, 4, 5].map((position) => ({
  id: `l${position}`,
  position,
  exercises: [],
}))
const cues = { sound: false, blink: false, flash: false, warningPercent: 15 }
const grid = { name: 'Tractions', version: 3, accentColor: '#00FF87' }

function renderLobby(userId: string, overrides: Partial<Room> = {}) {
  return render(
    <Lobby
      initialRoom={room(overrides)}
      userId={userId}
      grid={grid}
      levels={levels}
      cues={cues}
    />,
  )
}

beforeEach(() => {
  live.present = new Set()
  for (const fn of Object.values(actions)) fn.mockReset()
  router.push.mockReset()
  router.refresh.mockReset()
})

/** Ligne d'un participant, reperee a son nom affiche. */
function participant(name: string): HTMLElement {
  const item = screen
    .getAllByRole('listitem')
    .find((candidate) => candidate.textContent?.includes(name))
  if (!item) throw new Error(`participant introuvable : ${name}`)
  return item
}

describe('Lobby', () => {
  it('ne propose aucun niveau au-dessus du plafond du salon', () => {
    renderLobby('host')

    // Plafond : Bruno en est au niveau 2.
    expect(screen.getByRole('button', { name: 'Niveau 1' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Niveau 2' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Niveau 3' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Niveau 5' })).not.toBeInTheDocument()
  })

  it('lance au niveau choisi chez l hote', async () => {
    actions.startRoom.mockResolvedValue({ error: null })
    renderLobby('host')

    await userEvent.click(screen.getByRole('button', { name: 'Niveau 1' }))
    await userEvent.click(screen.getByRole('button', { name: /Lancer/ }))

    expect(actions.startRoom).toHaveBeenCalledWith('room-1', 'l1')
  })

  it('affiche le refus de lancement renvoye par le serveur', async () => {
    actions.startRoom.mockResolvedValue({ error: 'Ce niveau dépasse le plafond.' })
    renderLobby('host')

    await userEvent.click(screen.getByRole('button', { name: /Lancer/ }))

    expect(await screen.findByText('Ce niveau dépasse le plafond.')).toBeInTheDocument()
  })

  it('n affiche ni Lancer ni selecteur chez un invite', () => {
    renderLobby('guest')

    expect(screen.queryByRole('button', { name: /Lancer/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Niveau 1' })).not.toBeInTheDocument()
    expect(screen.getByText(/L'hôte choisit le niveau/)).toBeInTheDocument()
  })

  it('liste les participants, l hote et qui est present', () => {
    live.present = new Set(['host'])
    renderLobby('guest')

    const alice = participant('Alice')
    expect(alice).toHaveTextContent('Hôte')
    expect(alice).toHaveTextContent('Présent')
    // Le nom visible suffit : un aria-label le doublerait, et masquerait aux
    // lecteurs d'ecran l'hote et la presence.
    expect(alice).not.toHaveAttribute('aria-label')

    const bruno = participant('Bruno')
    expect(bruno).not.toHaveTextContent('Hôte')
    expect(bruno).toHaveTextContent('Absent')
  })

  it('quitter le salon ramene a l accueil', async () => {
    actions.leaveRoom.mockResolvedValue({ error: null })
    renderLobby('guest')

    await userEvent.click(screen.getByRole('button', { name: 'Quitter le salon' }))

    expect(actions.leaveRoom).toHaveBeenCalledWith('room-1')
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/'))
  })

  it('copie le lien du salon', async () => {
    const user = userEvent.setup()
    renderLobby('host')

    await user.click(screen.getByRole('button', { name: 'Copier le lien' }))

    expect(await navigator.clipboard.readText()).toBe(
      `${window.location.origin}/seance/groupe/room-1`,
    )
    expect(screen.getByRole('button', { name: 'Lien copié' })).toBeInTheDocument()
    // La confirmation est annoncee : le focus reste sur le bouton, et un
    // libelle qui change sous lui ne se lit pas de lui-meme.
    expect(screen.getByRole('status')).toHaveTextContent('Lien copié')
  })

  it('un salon termine quitte l ecran d attente', () => {
    renderLobby('guest', { status: 'finished', levelId: 'l2' })

    expect(
      screen.queryByRole('button', { name: 'Quitter le salon' }),
    ).not.toBeInTheDocument()
    expect(screen.getByText('La séance est terminée')).toBeInTheDocument()
  })
})

describe('RoomRefusal', () => {
  it('affiche le message de refus de version et ramene a l accueil', () => {
    render(
      <RoomRefusal message="Ta version de cette grille n'est pas celle du salon : tu ne peux pas y entrer." />,
    )

    expect(
      screen.getByText(/Ta version de cette grille n'est pas celle du salon/),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: "Retour à l'accueil" })).toHaveAttribute(
      'href',
      '/',
    )
  })
})

describe('AdoptToJoin', () => {
  it('adopte la grille puis retente l entree', async () => {
    actions.followGrid.mockResolvedValue({ error: null })
    render(<AdoptToJoin gridId="grid-1" gridName="Tractions" ownerName="Alice" />)

    expect(screen.getByText(/Alice/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Ajouter' }))

    expect(actions.followGrid).toHaveBeenCalledWith('grid-1')
    // Le rendu serveur rejoue l'entree une fois la grille adoptee.
    await waitFor(() => expect(router.refresh).toHaveBeenCalled())
  })
})

describe('OpenRoomButton', () => {
  it('ouvre un salon et y entre', async () => {
    actions.createRoom.mockResolvedValue({ roomId: 'room-9', error: null })
    render(<OpenRoomButton gridId="grid-1" />)

    await userEvent.click(screen.getByRole('button', { name: 'Séance à plusieurs' }))

    expect(actions.createRoom).toHaveBeenCalledWith('grid-1')
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/seance/groupe/room-9'))
  })

  it('affiche l erreur si le salon ne s ouvre pas', async () => {
    actions.createRoom.mockResolvedValue({
      roomId: null,
      error: "Le salon n'a pas pu être ouvert.",
    })
    render(<OpenRoomButton gridId="grid-1" />)

    await userEvent.click(screen.getByRole('button', { name: 'Séance à plusieurs' }))

    expect(
      await screen.findByText("Le salon n'a pas pu être ouvert."),
    ).toBeInTheDocument()
    expect(router.push).not.toHaveBeenCalled()
  })
})
