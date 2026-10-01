import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { TimerCuePreferences } from '@/lib/account/preferences'
import type { Level, LevelSet } from '@/lib/grids/model'
import type { Room, RoomMember } from '@/lib/session/group/model'
import { saveGroupRun } from '@/lib/session/group/run-store'
import type { SetResult } from '@/lib/session/model'
import { stopAllTimers } from '@/lib/session/timers'

import { GroupRunner } from './group-runner'

const actions = vi.hoisted(() => ({
  declareSet: vi.fn(),
  advanceRoom: vi.fn(),
  consolidateSession: vi.fn(),
}))

const router = vi.hoisted(() => ({ push: vi.fn() }))

vi.mock('next/navigation', () => ({ useRouter: () => router }))

vi.mock('../actions', () => ({
  declareSet: actions.declareSet,
  advanceRoom: actions.advanceRoom,
}))

vi.mock('@/app/seance/[gridId]/actions', () => ({
  consolidateSession: actions.consolidateSession,
}))

const silentCues: TimerCuePreferences = {
  sound: false,
  blink: false,
  flash: false,
  warningPercent: 15,
}

function set(position: number, over: Partial<LevelSet> = {}): LevelSet {
  return {
    id: `s${position}`,
    position,
    targetReps: 10 + position,
    timerMode: 'none',
    timerSeconds: null,
    ...over,
  }
}

/** Niveau 2 de la version figee : un exercice, les series donnees. */
function levelsWith(sets: LevelSet[]): Level[] {
  return [
    { id: 'l1', position: 1, exercises: [] },
    {
      id: 'l2',
      position: 2,
      exercises: [
        {
          id: 'e2',
          exerciseId: 'x2',
          exerciseName: 'Tractions',
          imageUrl: null,
          position: 1,
          sets,
        },
      ],
    },
    { id: 'l3', position: 3, exercises: [] },
  ]
}

const repsLevels = levelsWith([set(1), set(2)])

function member(
  userId: string,
  name: string,
  over: Partial<RoomMember> = {},
): RoomMember {
  return {
    userId,
    displayName: name,
    levelCeiling: 3,
    declaredCursor: -1,
    lastStatus: null,
    joinedAt: `2026-10-01T10:0${userId === 'host' ? 0 : 1}:00Z`,
    ...over,
  }
}

function room(over: Partial<Room> = {}): Room {
  return {
    id: 'room-1',
    gridId: 'grid-1',
    gridVersionId: 'v1',
    hostId: 'host',
    levelId: 'l2',
    status: 'running',
    cursor: 0,
    stage: 'set',
    restStartedAt: null,
    hostSeenAt: '2026-10-01T10:00:00.000Z',
    members: [member('host', 'Alice'), member('guest', 'Bruno')],
    ...over,
  }
}

function result(setIndex: number, status: SetResult['status'] = 'success'): SetResult {
  return {
    levelSetId: `s${setIndex + 1}`,
    setIndex,
    exerciseName: 'Tractions',
    setLabel: `Série ${setIndex + 1}/2`,
    unit: 'reps',
    targetValue: 11 + setIndex,
    actualValue: 11 + setIndex,
    status,
  }
}

type Props = {
  room?: Room
  userId?: string
  present?: string[]
  levels?: Level[]
  restSeconds?: number
}

const reload = vi.fn(async () => {})

function element({
  room: current = room(),
  userId = 'host',
  present = ['host', 'guest'],
  levels = repsLevels,
  restSeconds = 60,
}: Props = {}) {
  return (
    <GroupRunner
      room={current}
      presentIds={new Set(present)}
      userId={userId}
      reload={reload}
      grid={{ name: 'Haut du corps', version: 2, restSeconds }}
      levels={levels}
      cues={silentCues}
    />
  )
}

/** Seance rangee localement pour le salon, comme apres un rafraichissement. */
function stored(
  results: SetResult[],
  over: { saved?: boolean; startedAt?: number; undeclared?: number | null } = {},
) {
  saveGroupRun({
    roomId: 'room-1',
    levelId: 'l2',
    startedAt: over.startedAt ?? 1,
    results,
    timer: null,
    undeclared: over.undeclared ?? null,
    saved: over.saved ?? false,
  })
}

const finished = () => room({ status: 'finished', stage: 'finished', cursor: 1 })

beforeEach(() => {
  window.sessionStorage.clear()
  actions.declareSet.mockReset().mockResolvedValue({ error: null, stale: false })
  actions.advanceRoom.mockReset().mockResolvedValue({ error: null, stale: false })
  actions.consolidateSession
    .mockReset()
    .mockResolvedValue({ sessionId: 'sess-1', error: null })
  router.push.mockReset()
  reload.mockClear()
})

afterEach(() => {
  stopAllTimers()
  vi.useRealTimers()
})

describe('GroupRunner, serie en cours', () => {
  it('joue la serie du curseur, dans le niveau du salon', () => {
    render(element({ room: room({ cursor: 1 }) }))

    expect(screen.getByText('Tractions')).toBeInTheDocument()
    expect(screen.getByText('Niveau 2/3')).toBeInTheDocument()
    expect(screen.getByText(/Série 2\/2/)).toBeInTheDocument()
    expect(screen.getByText('objectif 12 reps')).toBeInTheDocument()
  })

  it('declare le statut seul, puis attend le groupe', async () => {
    render(element({ userId: 'guest' }))

    await userEvent.click(screen.getByRole('button', { name: 'Ajouter une répétition' }))
    await userEvent.click(screen.getByRole('button', { name: 'Valider la série' }))

    expect(actions.declareSet).toHaveBeenCalledWith('room-1', 0, 'surpass')
    expect(screen.getByText(/En attente du groupe/)).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Valider la série' }),
    ).not.toBeInTheDocument()
  })

  it('cloture d office une serie strict a l echeance', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(
      element({
        userId: 'guest',
        levels: levelsWith([set(1, { timerMode: 'strict', timerSeconds: 20 }), set(2)]),
      }),
    )

    await user.click(screen.getByRole('button', { name: 'Démarrer le chrono' }))
    await act(async () => {
      vi.advanceTimersByTime(20_500)
    })

    expect(actions.declareSet).toHaveBeenCalledWith('room-1', 0, 'fail')
    expect(screen.getByText(/En attente du groupe/)).toBeInTheDocument()
  })
})

describe('GroupRunner, attente du groupe', () => {
  it('l hote voit Passer quand meme, et force le passage', async () => {
    stored([result(0)])
    render(element())

    await userEvent.click(screen.getByRole('button', { name: 'Passer quand même' }))

    expect(actions.advanceRoom).toHaveBeenCalledWith(
      'room-1',
      0,
      'set',
      expect.arrayContaining(['host', 'guest']),
      true,
    )
  })

  it('un invite ne peut pas forcer', async () => {
    render(element({ userId: 'guest' }))

    await userEvent.click(screen.getByRole('button', { name: 'Valider la série' }))

    expect(
      screen.queryByRole('button', { name: 'Passer quand même' }),
    ).not.toBeInTheDocument()
  })

  it('montre le statut des autres, jamais leurs valeurs', async () => {
    render(
      element({
        userId: 'guest',
        room: room({
          members: [
            member('host', 'Alice', { declaredCursor: 0, lastStatus: 'surpass' }),
            member('guest', 'Bruno'),
          ],
        }),
      }),
    )

    await userEvent.click(screen.getByRole('button', { name: 'Valider la série' }))

    const alice = screen
      .getAllByRole('listitem')
      .find((item) => item.textContent?.includes('Alice'))!
    expect(within(alice).getByText('Dépassé')).toBeInTheDocument()
    expect(alice.textContent).not.toMatch(/\d/)
  })

  it('l hote n avance pas tant qu un present n a pas declare', async () => {
    render(element())

    await userEvent.click(screen.getByRole('button', { name: 'Valider la série' }))

    expect(actions.advanceRoom).not.toHaveBeenCalled()
  })

  it('l hote avance des que tous les presents ont declare', async () => {
    const { rerender } = render(element())
    await userEvent.click(screen.getByRole('button', { name: 'Valider la série' }))

    // Sa declaration et celle de Bruno reviennent par le salon.
    rerender(
      element({
        room: room({
          members: [
            member('host', 'Alice', { declaredCursor: 0, lastStatus: 'success' }),
            member('guest', 'Bruno', { declaredCursor: 0, lastStatus: 'fail' }),
          ],
        }),
      }),
    )

    await waitFor(() =>
      expect(actions.advanceRoom).toHaveBeenCalledWith(
        'room-1',
        0,
        'set',
        expect.arrayContaining(['host', 'guest']),
        false,
      ),
    )
    expect(actions.advanceRoom).toHaveBeenCalledOnce()
  })

  it('un absent ne retient pas le groupe', async () => {
    const { rerender } = render(element({ present: ['host'] }))
    await userEvent.click(screen.getByRole('button', { name: 'Valider la série' }))

    rerender(
      element({
        present: ['host'],
        room: room({
          members: [
            member('host', 'Alice', { declaredCursor: 0, lastStatus: 'success' }),
            member('guest', 'Bruno'),
          ],
        }),
      }),
    )

    await waitFor(() => expect(actions.advanceRoom).toHaveBeenCalledOnce())
  })

  it('un salon qui a deja bouge se relit sans erreur', async () => {
    actions.advanceRoom.mockResolvedValue({ error: null, stale: true })
    stored([result(0)])
    render(element())

    await userEvent.click(screen.getByRole('button', { name: 'Passer quand même' }))

    await waitFor(() => expect(reload).toHaveBeenCalled())
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('affiche une avance refusee', async () => {
    actions.advanceRoom.mockResolvedValue({
      error: "Le groupe n'a pas pu avancer.",
      stale: false,
    })
    stored([result(0)])
    render(element())

    await userEvent.click(screen.getByRole('button', { name: 'Passer quand même' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Le groupe n'a pas pu avancer.",
    )
  })

  it('corrige le chrono pendant l attente, et redeclare la serie', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(
      element({
        userId: 'guest',
        levels: levelsWith([set(1, { timerMode: 'minimal', timerSeconds: 30 }), set(2)]),
      }),
    )

    await user.click(screen.getByRole('button', { name: 'Démarrer le chrono' }))
    await act(async () => {
      vi.advanceTimersByTime(29_200)
    })
    await user.click(screen.getByRole('button', { name: 'Terminé' }))
    expect(actions.declareSet).toHaveBeenLastCalledWith('room-1', 0, 'fail')

    await user.click(screen.getByRole('button', { name: 'Ajouter une seconde' }))

    await waitFor(() =>
      expect(actions.declareSet).toHaveBeenLastCalledWith('room-1', 0, 'success'),
    )
  })
})

describe('GroupRunner, correction avant declaration', () => {
  const timedFirst = levelsWith([
    set(1, { timerMode: 'minimal', timerSeconds: 30 }),
    set(2),
  ])
  const timedLast = levelsWith([
    set(1),
    set(2, { timerMode: 'minimal', timerSeconds: 30 }),
  ])

  /** Tient 29 s sur 30, puis tape Termine : un echec a corriger. */
  async function holdShort(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole('button', { name: 'Démarrer le chrono' }))
    await act(async () => {
      vi.advanceTimersByTime(29_200)
    })
    await user.click(screen.getByRole('button', { name: 'Terminé' }))
  }

  it('sans repos derriere, corrige d abord et declare le statut corrige a Continuer', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(element({ userId: 'guest', levels: timedFirst, restSeconds: 0 }))

    await holdShort(user)

    // Rien ne part tant qu'on corrige : le groupe ne peut pas passer outre.
    expect(actions.declareSet).not.toHaveBeenCalled()
    expect(screen.queryByText(/En attente du groupe/)).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Ajouter une seconde' }))
    expect(actions.declareSet).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Continuer' }))

    expect(actions.declareSet).toHaveBeenCalledOnce()
    expect(actions.declareSet).toHaveBeenCalledWith('room-1', 0, 'success')
    expect(await screen.findByText(/En attente du groupe/)).toBeInTheDocument()
  })

  it('la derniere serie chronometree se corrige d abord, meme avec un repos', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    stored([result(0)])
    render(element({ userId: 'guest', room: room({ cursor: 1 }), levels: timedLast }))

    await holdShort(user)

    expect(actions.declareSet).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Continuer' })).toBeInTheDocument()
  })

  it('l hote n avance pas pendant qu il corrige, meme si les autres ont declare', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const othersDone = room({
      members: [
        member('host', 'Alice'),
        member('guest', 'Bruno', { declaredCursor: 0, lastStatus: 'success' }),
      ],
    })
    render(element({ room: othersDone, levels: timedFirst, restSeconds: 0 }))

    await holdShort(user)
    await act(async () => {
      vi.advanceTimersByTime(50)
    })

    expect(actions.advanceRoom).not.toHaveBeenCalled()
  })

  it('une serie close par le groupe pendant la correction est echouee', async () => {
    // L'hote a force pendant que l'on corrigeait la derniere serie : le salon
    // est fini, notre ligne ne porte aucune declaration a ce rang.
    stored([result(0), result(1)], { undeclared: 1 })
    render(
      element({
        userId: 'guest',
        room: room({
          status: 'finished',
          stage: 'finished',
          cursor: 1,
          members: [
            member('host', 'Alice'),
            member('guest', 'Bruno', { declaredCursor: 0 }),
          ],
        }),
      }),
    )

    await waitFor(() => expect(actions.consolidateSession).toHaveBeenCalledOnce())
    const sent = actions.consolidateSession.mock.calls[0][0]
    expect(sent.results.map((r: SetResult) => [r.setIndex, r.status])).toEqual([
      [0, 'success'],
      [1, 'fail'],
    ])
  })

  it('une declaration recue par le salon compte, meme sans reponse de l appel', async () => {
    stored([result(0), result(1)], { undeclared: 1 })
    render(
      element({
        userId: 'guest',
        room: room({
          status: 'finished',
          stage: 'finished',
          cursor: 1,
          members: [
            member('host', 'Alice'),
            member('guest', 'Bruno', { declaredCursor: 1 }),
          ],
        }),
      }),
    )

    await waitFor(() => expect(actions.consolidateSession).toHaveBeenCalledOnce())
    const sent = actions.consolidateSession.mock.calls[0][0]
    expect(sent.results.map((r: SetResult) => r.status)).toEqual(['success', 'success'])
  })

  it('une declaration refusee parce que le groupe est passe est echouee', async () => {
    actions.declareSet.mockResolvedValue({ error: null, stale: true })
    const single = levelsWith([set(1)])
    const { rerender } = render(element({ userId: 'guest', levels: single }))

    await userEvent.click(screen.getByRole('button', { name: 'Valider la série' }))
    await waitFor(() => expect(reload).toHaveBeenCalled())
    rerender(
      element({
        userId: 'guest',
        levels: single,
        room: room({ status: 'finished', stage: 'finished', cursor: 0 }),
      }),
    )

    await waitFor(() => expect(actions.consolidateSession).toHaveBeenCalledOnce())
    const sent = actions.consolidateSession.mock.calls[0][0]
    expect(sent.results.map((r: SetResult) => [r.setIndex, r.status])).toEqual([
      [0, 'fail'],
    ])
  })

  it('une declaration en echec se renvoie a Continuer', async () => {
    actions.declareSet.mockResolvedValueOnce({
      error: "La série n'a pas pu être déclarée.",
      stale: false,
    })
    render(element({ userId: 'guest' }))

    await userEvent.click(screen.getByRole('button', { name: 'Valider la série' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      "La série n'a pas pu être déclarée.",
    )

    await userEvent.click(screen.getByRole('button', { name: 'Continuer' }))

    await waitFor(() => expect(actions.declareSet).toHaveBeenCalledTimes(2))
    expect(await screen.findByText(/En attente du groupe/)).toBeInTheDocument()
  })
})

describe('GroupRunner, repos commun', () => {
  it('compte le repos depuis l instant pose par le serveur', () => {
    const startedAt = new Date(Date.now() - 10_000).toISOString()
    render(
      element({
        userId: 'guest',
        room: room({ stage: 'rest', restStartedAt: startedAt }),
      }),
    )

    expect(screen.getByText('50s')).toBeInTheDocument()
    expect(
      screen.getByText(/Prochaine série : Tractions · Série 2\/2/),
    ).toBeInTheDocument()
    // Le repos est a tout le groupe : un invite ne le coupe pas.
    expect(
      screen.queryByRole('button', { name: 'Passer le repos' }),
    ).not.toBeInTheDocument()
  })

  it('l hote fait avancer le groupe a l expiration du repos', async () => {
    const startedAt = new Date(Date.now() - 61_000).toISOString()
    render(element({ room: room({ stage: 'rest', restStartedAt: startedAt }) }))

    await waitFor(() =>
      expect(actions.advanceRoom).toHaveBeenCalledWith(
        'room-1',
        0,
        'rest',
        expect.any(Array),
        false,
      ),
    )
  })

  it('un invite n avance rien a l expiration du repos', async () => {
    const startedAt = new Date(Date.now() - 61_000).toISOString()
    render(
      element({
        userId: 'guest',
        room: room({ stage: 'rest', restStartedAt: startedAt }),
      }),
    )

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20))
    })
    expect(actions.advanceRoom).not.toHaveBeenCalled()
  })

  it('l hote peut couper le repos de tout le groupe', async () => {
    const startedAt = new Date().toISOString()
    render(element({ room: room({ stage: 'rest', restStartedAt: startedAt }) }))

    await userEvent.click(screen.getByRole('button', { name: 'Passer le repos' }))

    expect(actions.advanceRoom).toHaveBeenCalledWith(
      'room-1',
      0,
      'rest',
      expect.any(Array),
      false,
    )
  })
})

describe('GroupRunner, fin du niveau', () => {
  it('resume et enregistre sa seance, une fois, avec le salon', async () => {
    stored([result(0), result(1, 'fail')], {
      startedAt: Date.parse('2026-10-01T10:05:00Z'),
    })
    render(element({ room: finished() }))

    expect(screen.getByText('Niveau 2 non validé')).toBeInTheDocument()
    await waitFor(() => expect(actions.consolidateSession).toHaveBeenCalledOnce())
    expect(actions.consolidateSession).toHaveBeenCalledWith(
      expect.objectContaining({
        roomId: 'room-1',
        gridId: 'grid-1',
        levelId: 'l2',
        levelNumber: 2,
        gridName: 'Haut du corps',
        gridVersion: 2,
        validated: false,
        startedAt: '2026-10-01T10:05:00.000Z',
      }),
    )
  })

  it('compte echouee une serie passee sans nous', async () => {
    // Le groupe a ete force pendant la serie 1 : on n'a joue que la 2.
    stored([result(1)])
    render(element({ room: finished() }))

    await waitFor(() => expect(actions.consolidateSession).toHaveBeenCalledOnce())
    const sent = actions.consolidateSession.mock.calls[0][0]
    expect(sent.results.map((r: SetResult) => [r.setIndex, r.status])).toEqual([
      [0, 'fail'],
      [1, 'success'],
    ])
    expect(sent.results[0].actualValue).toBe(0)
  })

  it('n enregistre pas deux fois apres un rafraichissement', async () => {
    stored([result(0), result(1)], { saved: true })
    render(element({ room: finished() }))

    expect(screen.getByText('Niveau 2 validé')).toBeInTheDocument()
    expect(actions.consolidateSession).not.toHaveBeenCalled()
  })

  it('affiche un enregistrement refuse, et le retente', async () => {
    actions.consolidateSession.mockResolvedValueOnce({
      sessionId: null,
      error: "La séance n'a pas pu être enregistrée.",
    })
    stored([result(0), result(1)])
    render(element({ room: finished() }))

    await userEvent.click(await screen.findByRole('button', { name: 'Réessayer' }))

    await waitFor(() => expect(actions.consolidateSession).toHaveBeenCalledTimes(2))
  })

  it('sans rien joue ici, il ne reste qu a rentrer', () => {
    render(element({ room: finished() }))

    expect(screen.getByText('La séance est terminée')).toBeInTheDocument()
    expect(actions.consolidateSession).not.toHaveBeenCalled()
  })

  it('le retour a l accueil efface la seance locale', async () => {
    stored([result(0), result(1)], { saved: true })
    render(element({ room: finished() }))

    await userEvent.click(screen.getByRole('button', { name: "Retour à l'accueil" }))

    expect(router.push).toHaveBeenCalledWith('/')
    expect(window.sessionStorage.getItem('stonesteps.room.room-1')).toBeNull()
  })
})
