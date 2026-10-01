import { act, render, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import RoomPage from './[roomId]/page'
import { createRoom, startRoom } from './actions'
import { player, seedGrid } from './fake-room-world'

/**
 * Test d'acceptation de la tranche « salon » : de l'ouverture au lancement.
 *
 * Tout est reel — page, actions, regles du salon, suivi en direct, ecrans —
 * sauf la frontiere Supabase, tenue par la base en memoire de
 * fake-room-world.
 */

const world = await vi.hoisted(async () => {
  const { createRoomWorld } = await import('./fake-room-world')
  return createRoomWorld()
})

vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/log', () => ({ logSupabaseError: () => {} }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => world.client() }))
vi.mock('@/lib/supabase/client', () => ({ createClient: () => world.browserClient() }))

// Lectures de grille et d'historique : ce que la RLS rendrait a l'utilisateur
// courant. Les calculs de progression qui s'en servent restent reels.
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

/**
 * Ouvre le lien du salon en tant que `userId`, comme le ferait le navigateur.
 *
 * Sous act : l'entree pousse des evenements Realtime, et les salons deja
 * affiches se relisent dans la foulee.
 */
async function openLink(userId: string, roomId: string) {
  world.state.user = userId
  let view: ReturnType<typeof render> | undefined
  await act(async () => {
    const page = await RoomPage({
      params: Promise.resolve({ roomId }),
    } as PageProps<'/seance/groupe/[roomId]'>)
    view = render(page)
  })
  return within(view!.container)
}

beforeEach(() => {
  world.reset()
  seedGrid(world)

  // Alice en est au niveau 4, Bruno au 2. Camille suit une copie figee en v1.
  player(world, 'alice', 'Alice', 'owner', 3)
  player(world, 'bruno', 'Bruno', 'follower', 1)
  player(world, 'camille', 'Camille', 'frozen', 3)
  for (const name of ['Dora', 'Elio', 'Fanny', 'Gael', 'Hugo']) {
    player(world, name.toLowerCase(), name, 'follower', 3)
  }
})

describe('Salon a plusieurs, de l ouverture au lancement', () => {
  it('ouvre, accueille, refuse, puis lance tout le salon sur la serie 1', async () => {
    // A ouvre un salon : il en est l'hote et le premier membre.
    world.state.user = 'alice'
    const created = await createRoom('g1')
    expect(created.error).toBeNull()
    const roomId = created.roomId!

    const alice = await openLink('alice', roomId)
    expect(await alice.findByText(/^Alice/, { selector: 'li p' })).toBeInTheDocument()
    // Seule, Alice peut choisir jusqu'a son niveau en cours.
    expect(alice.getByRole('button', { name: 'Niveau 4' })).toBeInTheDocument()

    // B ouvre le lien : il entre, et le plafond descend a son niveau.
    const bruno = await openLink('bruno', roomId)
    expect(bruno.getByText(/^Bruno/, { selector: 'li p' })).toBeInTheDocument()
    expect(await alice.findByText(/^Bruno/, { selector: 'li p' })).toBeInTheDocument()
    await waitFor(() =>
      expect(alice.queryByRole('button', { name: 'Niveau 3' })).not.toBeInTheDocument(),
    )
    expect(alice.getByRole('button', { name: 'Niveau 2' })).toBeInTheDocument()
    expect(bruno.getByText(/jusqu.au niveau 2/)).toBeInTheDocument()

    // C joue une autre version : la porte reste fermee, avec le motif.
    const camille = await openLink('camille', roomId)
    expect(
      camille.getByText(/Ta version de cette grille n'est pas celle du salon/),
    ).toBeInTheDocument()
    expect(camille.queryByRole('list')).not.toBeInTheDocument()

    // Quatre de plus remplissent les six places ; le septieme est refuse.
    for (const id of ['dora', 'elio', 'fanny', 'gael']) await openLink(id, roomId)
    expect(await alice.findByText(/Participants · 6\/6/)).toBeInTheDocument()

    const hugo = await openLink('hugo', roomId)
    expect(hugo.getByText(/Le salon est complet/)).toBeInTheDocument()
    expect(
      world.state.members.filter((member) => member.room_id === roomId),
    ).toHaveLength(6)

    // A lance au niveau permis : tout le salon bascule sur la premiere serie.
    world.state.user = 'alice'
    await userEvent.click(alice.getByRole('button', { name: 'Niveau 2' }))
    await userEvent.click(alice.getByRole('button', { name: 'Lancer le niveau 2' }))

    for (const view of [alice, bruno]) {
      expect(await view.findByText('Niveau 2/4')).toBeInTheDocument()
      expect(view.getByText('Tractions')).toBeInTheDocument()
      expect(view.getByText(/Série 1\/2/)).toBeInTheDocument()
      expect(view.getByText('objectif 20 reps')).toBeInTheDocument()
      expect(view.getByRole('button', { name: 'Valider la série' })).toBeInTheDocument()
    }
    expect(world.state.rooms[0]).toMatchObject({ status: 'running', level_id: 'v2-l2' })
  })

  it('refuse au lancement un niveau au-dessus du plafond', async () => {
    world.state.user = 'alice'
    const { roomId } = await createRoom('g1')
    world.state.user = 'bruno'
    await openLink('bruno', roomId!)

    // L'interface ne le propose pas ; la base le refuse quand meme.
    world.state.user = 'alice'
    const result = await startRoom(roomId!, 'v2-l4')

    expect(result.error).toMatch(/dépasse le plafond du salon/)
    expect(world.state.rooms[0].status).toBe('open')
  })
})
