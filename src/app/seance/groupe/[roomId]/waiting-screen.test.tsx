import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type { MemberStatus } from '@/lib/session/group/run'

import { WaitingScreen } from './waiting-screen'

const others: MemberStatus[] = [
  { userId: 'b', name: 'Bruno', present: true, declared: true, status: 'surpass' },
  { userId: 'c', name: 'Chloé', present: true, declared: false, status: null },
  { userId: 'd', name: 'Dora', present: false, declared: false, status: null },
]

function row(name: string): HTMLElement {
  const item = screen
    .getAllByRole('listitem')
    .find((candidate) => candidate.textContent?.includes(name))
  if (!item) throw new Error(`participant introuvable : ${name}`)
  return item
}

describe('WaitingScreen', () => {
  it('annonce l attente du groupe', () => {
    render(
      <WaitingScreen
        others={others}
        correction={null}
        isHost={false}
        onForce={vi.fn()}
      />,
    )

    expect(screen.getByText(/En attente du groupe/)).toBeInTheDocument()
  })

  it('montre le statut de chacun, jamais ses valeurs', () => {
    render(
      <WaitingScreen
        others={others}
        correction={null}
        isHost={false}
        onForce={vi.fn()}
      />,
    )

    expect(within(row('Bruno')).getByText('Dépassé')).toBeInTheDocument()
    expect(within(row('Chloé')).getByText('En cours')).toBeInTheDocument()
    expect(within(row('Dora')).getByText('Absent')).toBeInTheDocument()
    // Aucun chiffre : ni reps, ni secondes des autres.
    for (const name of ['Bruno', 'Chloé', 'Dora']) {
      expect(row(name).textContent).not.toMatch(/\d/)
    }
  })

  it('l hote peut passer quand meme', async () => {
    const onForce = vi.fn()
    render(<WaitingScreen others={others} correction={null} isHost onForce={onForce} />)

    await userEvent.click(screen.getByRole('button', { name: 'Passer quand même' }))

    expect(onForce).toHaveBeenCalledOnce()
  })

  it('un invite ne peut pas forcer', () => {
    render(
      <WaitingScreen
        others={others}
        correction={null}
        isHost={false}
        onForce={vi.fn()}
      />,
    )

    expect(
      screen.queryByRole('button', { name: 'Passer quand même' }),
    ).not.toBeInTheDocument()
  })

  it('porte la correction du chrono', async () => {
    const onChange = vi.fn()
    render(
      <WaitingScreen
        others={others}
        correction={{ mode: 'minimal', value: 28, max: null, status: 'fail', onChange }}
        isHost={false}
        onForce={vi.fn()}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Ajouter une seconde' }))

    expect(onChange).toHaveBeenCalledWith(29)
  })
})
