import { act, render, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import RoomPage from './[roomId]/page'
import { claimRoomHost, createRoom } from './actions'
import { player, seedGrid } from './fake-room-world'

/**
 * Test d'acceptation des coupures et de la passation d'hote.
 *
 * Meme montage que run.flow.test.tsx : tout est reel sauf la frontiere
 * Supabase, tenue par la base en memoire de fake-room-world, qui rejoue aussi
 * heartbeat_room, claim_room_host et la passation au depart de l'hote.
 *
 * Plusieurs telephones, un seul document : on regarde l'un, puis l'autre.
 * Poser un telephone ne le deconnecte pas ; une coupure, si :
 * `world.disconnect` le retire de la presence du salon, comme le fait
 * Realtime quand le reseau tombe ou que l'onglet se ferme.
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

const room = () => world.state.rooms[0]

/** Statuts enregistres pour la seance de `userId`, dans l'ordre des series. */
function savedSets(userId: string) {
  const session = world.state.sessions.find((candidate) => candidate.owner_id === userId)
  return world.state.sessionSets
    .filter((entry) => entry.session_id === session?.id)
    .map((entry) => [entry.set_index, entry.status, entry.actual_value])
}

/** Salon ouvert par Alice, ou entrent les autres, dans l'ordre donne. */
async function openRoom(...guests: string[]) {
  world.state.user = 'alice'
  const { roomId } = await createRoom('g1')
  for (const guest of guests) await look(guest, roomId!)
  return roomId!
}

/** L'hote valide la serie en cours, puis coupe le repos qui suit. */
async function hostPlays(view: ReturnType<typeof within>, cursor: number) {
  await userEvent.click(await view.findByRole('button', { name: 'Valider la série' }))
  await userEvent.click(await view.findByRole('button', { name: 'Passer le repos' }))
  await waitFor(() => expect(room()).toMatchObject({ cursor: cursor + 1, stage: 'set' }))
}

beforeEach(() => {
  putDown()
  for (const key of Object.keys(phones)) delete phones[key]
  world.reset()
  seedGrid(world)

  // Alice, l'hote, en est au niveau 4 ; Bruno et Carla au 3.
  player(world, 'alice', 'Alice', 'owner', 3)
  player(world, 'bruno', 'Bruno', 'follower', 2)
  player(world, 'carla', 'Carla', 'follower', 2)
})

describe('Seance a plusieurs, coupures', () => {
  it('B coupe pendant deux series puis revient : deux echecs, niveau invalide chez lui seul', async () => {
    const roomId = await openRoom('bruno')
    let alice = await look('alice', roomId)
    await userEvent.click(alice.getByRole('button', { name: 'Lancer le niveau 3' }))
    expect(await alice.findByText(/Série 1\/4/)).toBeInTheDocument()

    // Serie 1 : Bruno la joue, puis Alice ; le groupe avance.
    const bruno = await look('bruno', roomId)
    await userEvent.click(bruno.getByRole('button', { name: 'Valider la série' }))
    expect(await bruno.findByText(/En attente du groupe/)).toBeInTheDocument()
    alice = await look('alice', roomId)
    await hostPlays(alice, 0)

    // Bruno perd le reseau : le groupe ne l'attend plus, et joue deux series
    // sans lui.
    putDown()
    world.disconnect('bruno', roomId)
    alice = await look('alice', roomId)
    await hostPlays(alice, 1)
    await hostPlays(alice, 2)

    // Bruno revient : il retrouve la serie en cours, la 4, et la joue.
    const back = await look('bruno', roomId)
    expect(await back.findByText(/Série 4\/4/)).toBeInTheDocument()
    await userEvent.click(back.getByRole('button', { name: 'Valider la série' }))
    expect(await back.findByText(/En attente du groupe/)).toBeInTheDocument()

    // Alice joue la derniere : tout le monde a declare, le niveau se termine.
    alice = await look('alice', roomId)
    await userEvent.click(alice.getByRole('button', { name: 'Valider la série' }))
    await waitFor(() => expect(room().status).toBe('finished'))
    expect(await alice.findByText('Niveau 3 validé')).toBeInTheDocument()

    // Bruno : les deux series passees sans lui sont echouees, valeur 0.
    const summary = await look('bruno', roomId)
    expect(await summary.findByText('Niveau 3 non validé')).toBeInTheDocument()
    await waitFor(() => expect(world.state.sessions).toHaveLength(2))
    expect(savedSets('bruno')).toEqual([
      [0, 'success', 30],
      [1, 'fail', 0],
      [2, 'fail', 0],
      [3, 'success', 30],
    ])
    expect(world.state.sessions.map((s) => [s.owner_id, s.validated])).toEqual([
      ['alice', true],
      ['bruno', false],
    ])
  })
})

describe('Seance a plusieurs, passation d hote', () => {
  it('A part en pleine seance : B prend la main et mene le groupe au resume', async () => {
    const roomId = await openRoom('bruno')
    const alice = await look('alice', roomId)
    await userEvent.click(alice.getByRole('button', { name: 'Lancer le niveau 3' }))
    expect(await alice.findByText(/Série 1\/4/)).toBeInTheDocument()

    // Alice ferme l'onglet : plus de presence, plus de battement. Quinze
    // secondes passent.
    putDown()
    world.disconnect('alice', roomId)
    room().host_seen_at = new Date(Date.now() - 16_000).toISOString()

    // Bruno, seul present, reclame la place, et l'obtient.
    const bruno = await look('bruno', roomId)
    expect(await bruno.findByText("Tu es maintenant l'hôte")).toBeInTheDocument()
    expect(room().host_id).toBe('bruno')

    // Il fait avancer le groupe sans attendre Alice, absente.
    for (const cursor of [0, 1, 2]) await hostPlays(bruno, cursor)
    await userEvent.click(bruno.getByRole('button', { name: 'Valider la série' }))
    await waitFor(() => expect(room().status).toBe('finished'))

    expect(await bruno.findByText('Niveau 3 validé')).toBeInTheDocument()
    await waitFor(() => expect(world.state.sessions).toHaveLength(1))
    expect(world.state.sessions[0]).toMatchObject({ owner_id: 'bruno', validated: true })
  })

  it('deux candidats simultanes : un seul hote', async () => {
    const roomId = await openRoom('bruno', 'carla')
    const alice = await look('alice', roomId)
    await userEvent.click(alice.getByRole('button', { name: 'Lancer le niveau 3' }))
    expect(await alice.findByText(/Série 1\/4/)).toBeInTheDocument()
    putDown()
    world.disconnect('alice', roomId)
    room().host_seen_at = new Date(Date.now() - 16_000).toISOString()

    // Chacun croit l'hote parti et reclame sa place sur le meme salon perime.
    // La base les prend l'un apres l'autre : le second trouve un hote vivant.
    world.state.user = 'carla'
    const first = await claimRoomHost(roomId)
    world.state.user = 'bruno'
    const second = await claimRoomHost(roomId)

    expect(first).toEqual({ claimed: true, error: null })
    expect(second).toEqual({ claimed: false, error: null })
    expect(room().host_id).toBe('carla')

    // Bruno n'en voit rien d'autre qu'un nouvel hote : ni erreur, ni bandeau.
    const bruno = await look('bruno', roomId)
    expect(await bruno.findByText(/Série 1\/4/)).toBeInTheDocument()
    expect(bruno.queryByRole('alert')).not.toBeInTheDocument()
    expect(bruno.queryByText("Tu es maintenant l'hôte")).not.toBeInTheDocument()
    expect(room().host_id).toBe('carla')
  })

  it('l hote quitte un salon ouvert : le plus ancien membre devient hote et lance', async () => {
    const roomId = await openRoom('bruno', 'carla')
    const alice = await look('alice', roomId)
    await userEvent.click(alice.getByRole('button', { name: 'Quitter le salon' }))
    await waitFor(() => expect(room().host_id).toBe('bruno'))
    expect(world.state.members.map((member) => member.user_id)).toEqual([
      'bruno',
      'carla',
    ])

    // Bruno, entre avant Carla, tient le salon : il choisit et lance.
    const bruno = await look('bruno', roomId)
    await userEvent.click(
      await bruno.findByRole('button', { name: 'Lancer le niveau 3' }),
    )
    await waitFor(() => expect(room().status).toBe('running'))

    const carla = await look('carla', roomId)
    expect(await carla.findByText(/Série 1\/4/)).toBeInTheDocument()
  })
})
