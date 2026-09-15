import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { TimerCuePreferences } from '@/lib/account/preferences'
import type { LevelSet } from '@/lib/grids/model'
import type { ConsolidateInput, ConsolidateResult } from '@/lib/session/model'
import { buildSteps } from '@/lib/session/steps'
import { runningTimerCount, stopAllTimers } from '@/lib/session/timers'

import { SessionRunner, type SessionPlan } from './session-runner'

/**
 * Reperes tous coupes.
 *
 * Le clignotement pose un minuteur, et plusieurs tests comptent les minuteurs
 * en cours : les laisser allumes ferait echouer des assertions qui ne parlent
 * pas d eux. Les reperes ont leur propre suite de tests.
 */
const silentCues: TimerCuePreferences = {
  sound: false,
  blink: false,
  flash: false,
  warningPercent: 15,
}

const push = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))

const consolidate = vi.fn(
  async (input: ConsolidateInput): Promise<ConsolidateResult> => ({
    sessionId: `sess-${input.levelNumber}`,
    error: null,
  }),
)
vi.mock('./actions', () => ({
  consolidateSession: (input: ConsolidateInput) => consolidate(input),
}))

function set(position: number, over: Partial<LevelSet> = {}): LevelSet {
  return {
    id: `set-${position}`,
    position,
    targetReps: 10,
    timerMode: 'none',
    timerSeconds: null,
    ...over,
  }
}

function plan(over: Partial<SessionPlan> = {}): SessionPlan {
  const steps = buildSteps({
    exercises: [
      {
        id: 'e1',
        exerciseId: 'x1',
        exerciseName: 'Pompes',
        position: 1,
        sets: [set(1), set(2)],
      },
    ],
  })

  return {
    gridId: 'g1',
    gridName: 'Push Day',
    gridVersion: 1,
    restSeconds: 0,
    levelId: 'l3',
    levelNumber: 3,
    levelCount: 12,
    steps,
    ...over,
  }
}

beforeEach(() => {
  window.sessionStorage.clear()
  push.mockClear()
  consolidate.mockClear()
})

afterEach(() => {
  stopAllTimers()
  vi.useRealTimers()
})

const validateButton = () => screen.getByRole('button', { name: 'Valider la série' })

describe('parcours d une seance sans chrono', () => {
  it('annonce le niveau, l exercice et la serie en cours', () => {
    render(<SessionRunner cues={silentCues} plan={plan()} />)
    expect(screen.getByText('Niveau 3/12')).toBeInTheDocument()
    expect(screen.getByText(/Exercice 1\/1/)).toBeInTheDocument()
    expect(screen.getByText(/Série 1\/2/)).toBeInTheDocument()
  })

  it('initialise le compteur a l objectif, pas a zero', () => {
    render(<SessionRunner cues={silentCues} plan={plan()} />)
    expect(screen.getByText('10')).toBeInTheDocument()
    expect(screen.getByText('objectif 10 reps')).toBeInTheDocument()
    expect(screen.getByText('10')).toHaveClass('text-success')
  })

  it('n ecrit le statut nulle part pendant la seance', () => {
    render(<SessionRunner cues={silentCues} plan={plan()} />)
    // Le chiffre porte la couleur ; le libelle ne reste que pour les lecteurs
    // d'ecran, en sr-only.
    expect(screen.queryByText('Réussi')).toHaveClass('sr-only')
  })

  it('fait evoluer la couleur du chiffre en direct pendant le reglage', async () => {
    const user = userEvent.setup()
    render(<SessionRunner cues={silentCues} plan={plan()} />)

    await user.click(screen.getByRole('button', { name: 'Ajouter une répétition' }))
    expect(screen.getByText('11')).toHaveClass('text-surpass')

    await user.click(screen.getByRole('button', { name: 'Retirer une répétition' }))
    await user.click(screen.getByRole('button', { name: 'Retirer une répétition' }))
    expect(screen.getByText('9')).toHaveClass('text-fail')
  })

  it('valide le niveau quand toutes les series sont reussies', async () => {
    const user = userEvent.setup()
    render(<SessionRunner cues={silentCues} plan={plan()} />)

    await user.click(validateButton())
    await user.click(validateButton())

    expect(await screen.findByText('Niveau 3 validé')).toBeInTheDocument()
    expect(screen.getByText('Prochaine séance : niveau 4')).toBeInTheDocument()
  })

  it('invalide le niveau des qu une seule serie est manquee', async () => {
    const user = userEvent.setup()
    render(<SessionRunner cues={silentCues} plan={plan()} />)

    // Premiere serie a l'objectif, seconde une repetition en dessous.
    await user.click(validateButton())
    await user.click(screen.getByRole('button', { name: 'Retirer une répétition' }))
    await user.click(validateButton())

    expect(await screen.findByText('Niveau 3 non validé')).toBeInTheDocument()
    expect(
      screen.getByText(/1 série manquée — la prochaine séance repart du niveau 3/),
    ).toBeInTheDocument()
  })

  it('consolide une seule fois, en fin de seance, avec le verdict calcule', async () => {
    const user = userEvent.setup()
    render(<SessionRunner cues={silentCues} plan={plan()} />)

    await user.click(validateButton())
    expect(consolidate).not.toHaveBeenCalled()

    await user.click(validateButton())
    await waitFor(() => expect(consolidate).toHaveBeenCalledTimes(1))

    const input = consolidate.mock.calls[0][0]
    expect(input.validated).toBe(true)
    expect(input.levelNumber).toBe(3)
    expect(input.results).toHaveLength(2)
    expect(input.results[0]).toMatchObject({
      exerciseName: 'Pompes',
      setLabel: 'Série 1/2',
      unit: 'reps',
      targetValue: 10,
      actualValue: 10,
      status: 'success',
    })
  })

  it('liste les series du resume avec leur statut', async () => {
    const user = userEvent.setup()
    render(<SessionRunner cues={silentCues} plan={plan()} />)

    await user.click(validateButton())
    await user.click(validateButton())

    expect(await screen.findByText('Série 1/2 · 10 / 10 reps')).toBeInTheDocument()
    expect(screen.getByText('Série 2/2 · 10 / 10 reps')).toBeInTheDocument()
  })
})

describe('repos', () => {
  it('s intercale entre deux series et annonce la suivante', async () => {
    const user = userEvent.setup()
    render(<SessionRunner cues={silentCues} plan={plan({ restSeconds: 60 })} />)

    await user.click(validateButton())

    expect(screen.getByText('Repos')).toBeInTheDocument()
    expect(screen.getByText('Prochaine série : Pompes · Série 2/2')).toBeInTheDocument()
  })

  it('se passe a la demande et rend la main sur la serie suivante', async () => {
    const user = userEvent.setup()
    render(<SessionRunner cues={silentCues} plan={plan({ restSeconds: 60 })} />)

    await user.click(validateButton())
    await user.click(screen.getByRole('button', { name: 'Passer le repos' }))

    expect(screen.getByText(/Série 2\/2/)).toBeInTheDocument()
    expect(screen.queryByText('Repos')).not.toBeInTheDocument()
  })

  it('ne s affiche jamais apres la derniere serie', async () => {
    const user = userEvent.setup()
    render(<SessionRunner cues={silentCues} plan={plan({ restSeconds: 60 })} />)

    await user.click(validateButton())
    await user.click(screen.getByRole('button', { name: 'Passer le repos' }))
    await user.click(validateButton())

    expect(await screen.findByText('Niveau 3 validé')).toBeInTheDocument()
    expect(screen.queryByText('Repos')).not.toBeInTheDocument()
  })

  it('ne s affiche pas quand il est desactive sur la grille', async () => {
    const user = userEvent.setup()
    render(<SessionRunner cues={silentCues} plan={plan({ restSeconds: 0 })} />)

    await user.click(validateButton())
    expect(screen.queryByText('Repos')).not.toBeInTheDocument()
    expect(screen.getByText(/Série 2\/2/)).toBeInTheDocument()
  })
})

describe('serie strict', () => {
  const strictPlan = () =>
    plan({
      steps: buildSteps({
        exercises: [
          {
            id: 'e1',
            exerciseId: 'x1',
            exerciseName: 'Pompes sautees',
            position: 1,
            sets: [set(1, { timerMode: 'strict', timerSeconds: 40, targetReps: 8 })],
          },
        ],
      }),
    })

  it('reste neutre pendant l effort', async () => {
    const user = userEvent.setup()
    render(<SessionRunner cues={silentCues} plan={strictPlan()} />)

    // Neutre, donc cyan : ni vert ni rose tant que le verdict n'est pas tombe.
    expect(screen.getByText('40s')).toHaveClass('text-live')
    await user.click(screen.getByRole('button', { name: 'Démarrer le chrono' }))
    expect(screen.getByText('40s')).toHaveClass('text-live')
    expect(screen.getByRole('button', { name: 'Terminé' })).toBeInTheDocument()
  })

  it('se clot automatiquement en echec quand le compte a rebours atteint zero', async () => {
    // fireEvent et non userEvent : ce dernier attend de vrais delais entre ses
    // evenements, ce qui se bloque contre des minuteurs simules.
    vi.useFakeTimers()
    render(<SessionRunner cues={silentCues} plan={strictPlan()} />)

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Démarrer le chrono' }))
    })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(40_000)
    })

    expect(screen.getByText('Niveau 3 non validé')).toBeInTheDocument()
    expect(screen.getByText('Série 1/1 · 40s / 40s')).toBeInTheDocument()
  })
})

describe('sortie de seance', () => {
  it('demande confirmation avant d abandonner la progression', async () => {
    const user = userEvent.setup()
    render(<SessionRunner cues={silentCues} plan={plan()} />)

    await user.click(screen.getByRole('button', { name: 'Quitter la séance' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Continuer la séance' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(push).not.toHaveBeenCalled()
  })

  it('n arrete aucun minuteur en trop et rentre a l accueil', async () => {
    const user = userEvent.setup()
    render(<SessionRunner cues={silentCues} plan={plan({ restSeconds: 60 })} />)

    await user.click(validateButton())
    expect(runningTimerCount()).toBeGreaterThan(0)

    await user.click(screen.getByRole('button', { name: 'Quitter la séance' }))
    await user.click(screen.getByRole('button', { name: 'Quitter' }))

    expect(runningTimerCount()).toBe(0)
    expect(push).toHaveBeenCalledWith('/')
    expect(window.sessionStorage.getItem('stonesteps.run.g1')).toBeNull()
  })
})

describe('reprise apres rafraichissement', () => {
  it('repart la ou la seance en etait', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<SessionRunner cues={silentCues} plan={plan()} />)

    await user.click(validateButton())
    await waitFor(() =>
      expect(window.sessionStorage.getItem('stonesteps.run.g1')).not.toBeNull(),
    )
    unmount()

    render(<SessionRunner cues={silentCues} plan={plan()} />)
    expect(await screen.findByText(/Série 2\/2/)).toBeInTheDocument()
  })

  it('ignore un etat enregistre pour un autre niveau', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<SessionRunner cues={silentCues} plan={plan()} />)

    await user.click(validateButton())
    await waitFor(() =>
      expect(window.sessionStorage.getItem('stonesteps.run.g1')).not.toBeNull(),
    )
    unmount()

    // Le niveau a ete valide entre-temps : la seance suivante porte sur un
    // autre niveau, l'etat conserve ne la concerne plus.
    render(
      <SessionRunner cues={silentCues} plan={plan({ levelId: 'l4', levelNumber: 4 })} />,
    )
    expect(await screen.findByText(/Série 1\/2/)).toBeInTheDocument()
  })
})

describe('reperes du chrono', () => {
  const blinkCues: TimerCuePreferences = {
    ...silentCues,
    blink: true,
    warningPercent: 25,
  }

  const strictPlan = () =>
    plan({
      steps: buildSteps({
        exercises: [
          {
            id: 'e1',
            exerciseId: 'x1',
            exerciseName: 'Pompes sautees',
            position: 1,
            sets: [set(1, { timerMode: 'strict', timerSeconds: 40, targetReps: 8 })],
          },
        ],
      }),
    })

  const flash = (container: HTMLElement) =>
    container.querySelector('[aria-hidden="true"].bg-success')

  it('clignote au depart du chrono', async () => {
    vi.useFakeTimers()
    const { container } = render(<SessionRunner cues={blinkCues} plan={strictPlan()} />)

    expect(flash(container)).toBeNull()

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Démarrer le chrono' }))
    })
    expect(flash(container)).not.toBeNull()

    // Le repere est bref : il ne doit pas masquer l'ecran pendant l'effort.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400)
    })
    expect(flash(container)).toBeNull()
  })

  it('clignote a l approche de la fin', async () => {
    vi.useFakeTimers()
    const { container } = render(<SessionRunner cues={blinkCues} plan={strictPlan()} />)

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Démarrer le chrono' }))
    })

    // Fenetre de 25 % sur 40 s : rien avant la trentieme seconde.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000)
    })
    expect(flash(container)).toBeNull()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(11_000)
    })
    expect(flash(container)).not.toBeNull()
  })

  it('ne clignote pas quand tout est coupe', async () => {
    vi.useFakeTimers()
    const { container } = render(<SessionRunner cues={silentCues} plan={strictPlan()} />)

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Démarrer le chrono' }))
    })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(35_000)
    })
    expect(flash(container)).toBeNull()
  })
})
