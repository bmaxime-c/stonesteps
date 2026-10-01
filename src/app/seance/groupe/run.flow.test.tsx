import { act, render, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { gridProgress } from '@/lib/grids/progress'

import RoomPage from './[roomId]/page'
import { createRoom } from './actions'
import { gridFor, player, seedGrid } from './fake-room-world'

/**
 * Test d'acceptation de la seance synchronisee : du lancement aux deux
 * seances enregistrees.
 *
 * Tout est reel -- page, actions, consolidation, regles, suivi en direct,
 * ecrans -- sauf la frontiere Supabase, tenue par la base en memoire de
 * fake-room-world, qui rejoue declare_set et advance_room.
 *
 * Deux telephones, un seul document : on regarde l'un, puis l'autre. Chaque
 * coup d'oeil remonte la page du participant, avec son propre sessionStorage,
 * comme s'il rallumait son ecran ; entre-temps, il reste connecte au salon.
 */

const world = await vi.hoisted(async () => {
  const { createRoomWorld } = await import('./fake-room-world')
  return createRoomWorld()
})

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({ revalidatePath: () => {} }))
vi.mock('@/lib/supabase/log', () => ({ logSupabaseError: () => {} }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => world.client() }))
vi.mock('@/lib/supabase/client', () => ({ createClient: () => world.browserClient() }))

vi.mock('@/lib/grids/queries', () => ({
  loadGrid: async () => world.state.grids[world.state.user ?? ''] ?? null,
}))
vi.mock('@/lib/session/queries', () => ({
  loadLevelOutcomes: async () => world.outcomesOf(world.state.user ?? ''),
}))
vi.mock('@/lib/account/queries', () => ({
  loadTimerCues: async () => ({
    sound: false,
    blink: false,
    flash: false,
    warningPercent: 15,
  }),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  redirect: (url: string) => {
    throw new Error(`redirect inattendu vers ${url}`)
  },
}))

vi.mock('@/app/(app)/grilles/actions', () => ({
  followGrid: vi.fn(),
  unfollowGrid: vi.fn(),
  duplicateGrid: vi.fn(),
}))

/** sessionStorage de chaque telephone, mis de cote quand on ne le regarde pas. */
const phones: Record<string, Record<string, string>> = {}
let looking: { userId: string; unmount: () => void } | null = null

function putDown() {
  if (!looking) return
  looking.unmount()
  phones[looking.userId] = { ...window.sessionStorage }
  window.sessionStorage.clear()
  looking = null
}

/** Regarde le telephone de `userId` : sa page du salon, son stockage. */
async function look(userId: string, roomId: string) {
  putDown()
  for (const [key, value] of Object.entries(phones[userId] ?? {})) {
    window.sessionStorage.setItem(key, value)
  }
  world.state.user = userId

  let view: ReturnType<typeof render> | undefined
  await act(async () => {
    const page = await RoomPage({
      params: Promise.resolve({ roomId }),
    } as PageProps<'/seance/groupe/[roomId]'>)
    view = render(page)
  })
  looking = { userId, unmount: view!.unmount }
  return within(view!.container)
}

/** Ligne d'un participant sur l'ecran d'attente. */
function row(view: ReturnType<typeof within>, name: string): HTMLElement {
  const item = view
    .getAllByRole('listitem')
    .find((candidate: HTMLElement) => candidate.textContent?.includes(name))
  if (!item) throw new Error(`participant introuvable : ${name}`)
  return item
}

/** Niveau en cours d'un joueur, recalcule depuis son historique. */
function currentLevel(userId: string, kind: 'owner' | 'follower') {
  return gridProgress(gridFor(kind), world.outcomesOf(userId))?.current?.position
}

const room = () => world.state.rooms[0]

beforeEach(() => {
  putDown()
  for (const key of Object.keys(phones)) delete phones[key]
  world.reset()
  seedGrid(world)

  // Alice, l'hote, en est au niveau 4 ; Bruno au 2. Le salon jouera le 2.
  player(world, 'alice', 'Alice', 'owner', 3)
  player(world, 'bruno', 'Bruno', 'follower', 1)
})

describe('Seance a plusieurs, synchronisee', () => {
  it('declare, attend, repose ensemble, force, puis enregistre chacun sa seance', async () => {
    // Ouverture, entree de Bruno, lancement du niveau 2 par Alice.
    world.state.user = 'alice'
    const { roomId } = await createRoom('g1')
    await look('bruno', roomId!)
    let alice = await look('alice', roomId!)
    await userEvent.click(alice.getByRole('button', { name: 'Lancer le niveau 2' }))
    expect(await alice.findByText('Niveau 2/4')).toBeInTheDocument()

    // Serie 1 : Alice depasse son objectif et declare. Bruno, present, n'a
    // pas fini : le groupe l'attend.
    await userEvent.click(alice.getByRole('button', { name: 'Ajouter une répétition' }))
    await userEvent.click(alice.getByRole('button', { name: 'Valider la série' }))
    expect(await alice.findByText(/En attente du groupe/)).toBeInTheDocument()
    expect(within(row(alice, 'Bruno')).getByText('En cours')).toBeInTheDocument()
    expect(room()).toMatchObject({ cursor: 0, stage: 'set' })

    // Bruno reussit et declare. Il voit le statut d'Alice, jamais ses reps.
    let bruno = await look('bruno', roomId!)
    await userEvent.click(bruno.getByRole('button', { name: 'Valider la série' }))
    expect(await bruno.findByText(/En attente du groupe/)).toBeInTheDocument()
    const aliceRow = row(bruno, 'Alice')
    expect(within(aliceRow).getByText('Dépassé')).toBeInTheDocument()
    expect(aliceRow.textContent).not.toMatch(/\d/)
    expect(world.state.members.map((m) => [m.user_id, m.last_status])).toEqual([
      ['alice', 'surpass'],
      ['bruno', 'success'],
    ])

    // Alice reprend son telephone : tout le monde a declare, elle fait
    // avancer le groupe, qui entre dans le repos commun.
    alice = await look('alice', roomId!)
    await waitFor(() => expect(room().stage).toBe('rest'))
    expect(await alice.findByText('Repos')).toBeInTheDocument()

    // Meme compte a rebours chez Bruno : il part de l'instant serveur.
    bruno = await look('bruno', roomId!)
    expect(bruno.getByText(/^(60|59)s$/)).toBeInTheDocument()
    expect(
      bruno.queryByRole('button', { name: 'Passer le repos' }),
    ).not.toBeInTheDocument()

    // Le repos expire chez l'hote : le groupe passe a la serie 2.
    alice = await look('alice', roomId!)
    await act(async () => {
      room().rest_started_at = new Date(Date.now() - 61_000).toISOString()
      world.broadcast(roomId!)
    })
    await waitFor(() => expect(room()).toMatchObject({ cursor: 1, stage: 'set' }))
    expect(await alice.findByText(/Série 2\/2/)).toBeInTheDocument()

    // Serie 2, la derniere : Alice la reussit, et force sans attendre Bruno.
    await userEvent.click(alice.getByRole('button', { name: 'Valider la série' }))
    await userEvent.click(await alice.findByRole('button', { name: 'Passer quand même' }))
    await waitFor(() => expect(room().status).toBe('finished'))

    // Alice : niveau 2 valide, seance enregistree, son niveau en cours ne
    // bouge pas -- un niveau inferieur n'entre que dans l'historique.
    expect(await alice.findByText('Niveau 2 validé')).toBeInTheDocument()
    await waitFor(() => expect(world.state.sessions).toHaveLength(1))
    expect(world.state.sessions[0]).toMatchObject({
      owner_id: 'alice',
      level_id: 'v2-l2',
      level_number: 2,
      validated: true,
    })
    expect(world.state.sessions[0].completed_at).not.toBeNull()
    expect(currentLevel('alice', 'owner')).toBe(4)

    // Bruno : la serie passee sans lui est echouee, valeur 0. Sa seance est
    // enregistree, non validee, et il reste au niveau 2.
    bruno = await look('bruno', roomId!)
    expect(await bruno.findByText('Niveau 2 non validé')).toBeInTheDocument()
    await waitFor(() => expect(world.state.sessions).toHaveLength(2))
    expect(world.state.sessions[1]).toMatchObject({
      owner_id: 'bruno',
      level_id: 'v2-l2',
      level_number: 2,
      validated: false,
    })
    const brunoSets = world.state.sessionSets.filter(
      (entry) => entry.session_id === world.state.sessions[1].id,
    )
    expect(brunoSets.map((entry) => [entry.set_index, entry.status])).toEqual([
      [0, 'success'],
      [1, 'fail'],
    ])
    expect(brunoSets[1].actual_value).toBe(0)
    expect(currentLevel('bruno', 'follower')).toBe(2)

    // Un nouveau coup d'oeil n'enregistre pas une seconde fois.
    alice = await look('alice', roomId!)
    expect(await alice.findByText('Niveau 2 validé')).toBeInTheDocument()
    expect(world.state.sessions).toHaveLength(2)
  })
})
