import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { TimerCuePreferences } from '@/lib/account/preferences'
import type { Level, LevelSet } from '@/lib/grids/model'
import type { Room } from '@/lib/session/group/model'

import { Lobby } from './lobby'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))

// Le salon en direct est teste a part : ici, il rend le salon tel quel.
vi.mock('@/lib/session/group/use-room', () => ({
  useRoom: (initial: Room) => ({ room: initial, presentIds: new Set<string>() }),
}))

vi.mock('../actions', () => ({
  leaveRoom: vi.fn(),
  startRoom: vi.fn(),
}))

const silentCues: TimerCuePreferences = {
  sound: false,
  blink: false,
  flash: false,
  warningPercent: 15,
}

function set(id: string, position: number, targetReps: number): LevelSet {
  return { id, position, targetReps, timerMode: 'none', timerSeconds: null }
}

function level(position: number, exerciseName: string): Level {
  return {
    id: `l${position}`,
    position,
    exercises: [
      {
        id: `e${position}`,
        exerciseId: `x${position}`,
        exerciseName,
        imageUrl: null,
        position: 1,
        sets: [
          set(`s${position}-1`, 1, position * 10),
          set(`s${position}-2`, 2, position * 10 + 1),
        ],
      },
    ],
  }
}

// Niveaux de la version figee du salon.
const levels = [level(1, 'Pompes'), level(2, 'Tractions'), level(3, 'Dips')]

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
    members: [
      {
        userId: 'host',
        displayName: 'Alice',
        levelCeiling: 3,
        declaredCursor: -1,
        lastStatus: null,
        joinedAt: '2026-10-01T10:00:00Z',
      },
    ],
    ...overrides,
  }
}

function renderLobby(overrides: Partial<Room> = {}) {
  return render(
    <Lobby
      initialRoom={room(overrides)}
      userId="host"
      grid={{ name: 'Haut du corps', version: 2, accentColor: '#00FF87' }}
      levels={levels}
      cues={silentCues}
    />,
  )
}

describe('GroupRunner', () => {
  it('un salon lance bascule sur la premiere serie du niveau du salon', () => {
    renderLobby({ status: 'running', levelId: 'l2', cursor: 0 })

    expect(screen.getByText('Tractions')).toBeInTheDocument()
    expect(screen.getByText('Niveau 2/3')).toBeInTheDocument()
    expect(screen.getByText(/Série 1\/2/)).toBeInTheDocument()
    // Le compteur part de l'objectif de la premiere serie du niveau 2.
    expect(screen.getByText('objectif 20 reps')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Valider la série' })).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Quitter le salon' }),
    ).not.toBeInTheDocument()
  })

  it('suit le curseur du salon', () => {
    renderLobby({ status: 'running', levelId: 'l2', cursor: 1 })

    expect(screen.getByText(/Série 2\/2/)).toBeInTheDocument()
    expect(screen.getByText('objectif 21 reps')).toBeInTheDocument()
  })

  it('un salon ouvert reste sur l ecran d attente', () => {
    renderLobby({ status: 'open' })

    expect(screen.getByRole('button', { name: 'Quitter le salon' })).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Valider la série' }),
    ).not.toBeInTheDocument()
  })
})
