import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { buildSteps } from '@/lib/session/steps'

import { RunnerHeader } from './runner-header'

const steps = buildSteps({
  exercises: [
    {
      id: 'e1',
      exerciseId: 'x1',
      exerciseName: 'Pompes',
      imageUrl: null,
      position: 1,
      sets: [
        { id: 's1', position: 1, targetReps: 10, timerMode: 'none', timerSeconds: null },
        { id: 's2', position: 2, targetReps: 10, timerMode: 'none', timerSeconds: null },
      ],
    },
    {
      id: 'e2',
      exerciseId: 'x2',
      exerciseName: 'Dips',
      imageUrl: 'https://img/dips.webp',
      position: 2,
      sets: [
        { id: 's3', position: 1, targetReps: 8, timerMode: 'none', timerSeconds: null },
      ],
    },
  ],
})

describe('RunnerHeader', () => {
  it('annonce le niveau, l exercice et la serie', () => {
    render(
      <RunnerHeader
        levelNumber={3}
        levelCount={12}
        step={steps[1]}
        shown={steps[1]}
        done={1}
        total={steps.length}
      />,
    )

    expect(screen.getByText('Niveau 3/12')).toBeInTheDocument()
    expect(screen.getByText(/Exercice 1\/2 · Série 2\/2/)).toBeInTheDocument()
    expect(screen.getByText('Pompes')).toBeInTheDocument()
  })

  it('montre l exercice annonce, et son image', () => {
    // Pendant le repos, l'en-tete reste sur la serie finie, l'exercice montre
    // est celui qui vient.
    render(
      <RunnerHeader
        levelNumber={3}
        levelCount={12}
        step={steps[1]}
        shown={steps[2]}
        done={2}
        total={steps.length}
      />,
    )

    expect(screen.getByText(/Série 2\/2/)).toBeInTheDocument()
    expect(screen.getByText('Dips')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Illustration : Dips' })).toBeInTheDocument()
  })

  it('remplit la barre au prorata des series closes', () => {
    const { container } = render(
      <RunnerHeader
        levelNumber={1}
        levelCount={1}
        step={steps[0]}
        shown={steps[0]}
        done={1}
        total={4}
      />,
    )

    expect(container.querySelector('[style]')).toHaveStyle({ width: '25%' })
  })

  it('n offre la sortie que si on la lui donne', async () => {
    const onExit = vi.fn()
    const { rerender } = render(
      <RunnerHeader
        levelNumber={1}
        levelCount={1}
        step={steps[0]}
        shown={steps[0]}
        done={0}
        total={3}
      />,
    )
    expect(
      screen.queryByRole('button', { name: 'Quitter la séance' }),
    ).not.toBeInTheDocument()

    rerender(
      <RunnerHeader
        levelNumber={1}
        levelCount={1}
        step={steps[0]}
        shown={steps[0]}
        done={0}
        total={3}
        onExit={onExit}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Quitter la séance' }))
    expect(onExit).toHaveBeenCalledOnce()
  })
})
