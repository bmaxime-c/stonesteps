'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import type { TimerCuePreferences } from '@/lib/account/preferences'
import type { Level } from '@/lib/grids/model'
import type { Room } from '@/lib/session/group/model'
import { ROOM_CAPACITY, roomCeiling, selectableLevels } from '@/lib/session/group/room'
import { useRoom } from '@/lib/session/group/use-room'
import { cn } from '@/lib/utils'

import { leaveRoom, startRoom } from '../actions'
import { GroupRunner } from './group-runner'

type LobbyLevel = Pick<Level, 'id' | 'position'>

/**
 * Salon d'attente d'une seance a plusieurs.
 *
 * Chacun y voit qui est entre et qui est la ; l'hote seul choisit le niveau
 * et lance. Le plafond suit le moins avance des participants, et se recalcule
 * a chaque entree ou sortie : le salon est relu en direct, et les niveaux
 * proposes en decoulent sans jamais etre stockes.
 *
 * Plein ecran, sans barre : on n'en sort qu'en quittant le salon. Au
 * lancement, tout le salon bascule sur le coureur de groupe.
 */
export function Lobby({
  initialRoom,
  userId,
  grid,
  levels,
  cues,
}: {
  initialRoom: Room
  userId: string
  grid: { name: string; version: number; accentColor: string }
  /** Niveaux de la version figee du salon. */
  levels: Level[]
  cues: TimerCuePreferences
}) {
  const { room, presentIds } = useRoom(initialRoom, userId)

  if (room.status === 'running') {
    return <GroupRunner room={room} levels={levels} cues={cues} />
  }
  if (room.status === 'finished') return <Finished gridName={grid.name} />

  const isHost = room.hostId === userId
  const ceiling = roomCeiling(room.members)

  return (
    <main className="gutter mx-auto flex min-h-dvh w-full max-w-[720px] flex-col gap-[18px] pt-[clamp(20px,3vw,36px)] pb-10">
      <div className="flex items-center gap-4">
        <span
          className="text-ink-neon flex size-[52px] shrink-0 items-center justify-center rounded-[16px] text-[13px] font-extrabold"
          style={{ background: grid.accentColor }}
          aria-hidden="true"
        >
          {room.members.length}/{ROOM_CAPACITY}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-tertiary text-[13px] font-bold tracking-[0.1em] uppercase">
            Séance à plusieurs
          </p>
          <h1 className="truncate text-[24px] font-extrabold">{grid.name}</h1>
          <p className="text-tertiary text-[13px]">Version {grid.version}</p>
        </div>
      </div>

      <InviteLink roomId={room.id} />

      <section className="flex flex-col gap-2.5" aria-labelledby="participants">
        <h2
          id="participants"
          className="text-tertiary text-[13px] font-bold tracking-[0.06em] uppercase"
        >
          Participants · {room.members.length}/{ROOM_CAPACITY}
        </h2>
        <ul className="flex flex-col gap-2">
          {room.members.map((member) => {
            const name = member.displayName ?? 'Participant sans nom'
            const present = presentIds.has(member.userId)
            return (
              <li
                key={member.userId}
                aria-label={name}
                className="bg-card border-border flex items-center gap-3 rounded-[14px] border px-4 py-3"
              >
                <span
                  className={cn(
                    'size-2.5 shrink-0 rounded-full',
                    present
                      ? 'bg-success shadow-[0_0_10px_rgb(0_255_135/0.6)]'
                      : 'bg-border-strong',
                  )}
                  aria-hidden="true"
                />
                <p className="min-w-0 flex-1 truncate text-[15px] font-semibold">
                  {name}
                  {member.userId === userId ? (
                    <span className="text-tertiary font-normal"> (toi)</span>
                  ) : null}
                </p>
                {member.userId === room.hostId ? (
                  <span className="bg-chip text-muted-foreground rounded-full px-2.5 py-1 text-[11px] font-bold">
                    Hôte
                  </span>
                ) : null}
                <span
                  className={cn(
                    'text-[12px] font-semibold',
                    present ? 'text-success' : 'text-tertiary',
                  )}
                >
                  {present ? 'Présent' : 'Absent'}
                </span>
              </li>
            )
          })}
        </ul>
      </section>

      {isHost ? (
        <HostControls roomId={room.id} levels={selectableLevels(levels, ceiling)} />
      ) : (
        <p className="bg-inset border-border text-muted-foreground rounded-[16px] border px-4 py-3.5 text-center text-[14px]">
          L&apos;hôte choisit le niveau, jusqu&apos;au niveau {ceiling} : le niveau en
          cours du participant le moins avancé.
        </p>
      )}

      <LeaveButton roomId={room.id} />
    </main>
  )
}

/** Lien d'invitation, a copier pour l'envoyer aux autres. */
function InviteLink({ roomId }: { roomId: string }) {
  const [copied, setCopied] = useState(false)
  const [failed, setFailed] = useState(false)

  return (
    <div className="bg-card border-border flex flex-wrap items-center justify-between gap-3 rounded-[16px] border p-4">
      <p className="text-muted-foreground min-w-0 flex-1 text-[14px]">
        Envoie le lien du salon : {ROOM_CAPACITY} participants au plus, toi compris.
      </p>
      <button
        type="button"
        onClick={async () => {
          // L'adresse se lit au clic : au rendu serveur, il n'y a pas de
          // fenetre, et l'origine n'est pas connue.
          const url = `${window.location.origin}/seance/groupe/${roomId}`
          try {
            await navigator.clipboard.writeText(url)
            setCopied(true)
            setFailed(false)
          } catch {
            setFailed(true)
          }
        }}
        className="bg-primary text-primary-foreground rounded-full px-4 py-2.5 text-sm font-bold whitespace-nowrap"
      >
        {copied ? 'Lien copié' : 'Copier le lien'}
      </button>
      {failed ? (
        <p className="text-fail w-full text-[12px] font-semibold">
          Copie impossible : partage l&apos;adresse de cette page.
        </p>
      ) : null}
    </div>
  )
}

/**
 * Choix du niveau et lancement, chez l'hote.
 *
 * Par defaut, le plus haut niveau permis : c'est la ou en est le moins avance.
 * Un choix devenu interdit (un participant moins avance vient d'entrer)
 * retombe sur ce defaut au lieu de rester affiche.
 */
function HostControls({ roomId, levels }: { roomId: string; levels: LobbyLevel[] }) {
  const [chosenId, setChosenId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const selected =
    levels.find((level) => level.id === chosenId) ?? levels[levels.length - 1] ?? null

  if (!selected) {
    return (
      <p className="bg-inset border-border text-muted-foreground rounded-[16px] border px-4 py-3.5 text-center text-[14px]">
        Aucun niveau n&apos;est encore ouvert à tout le salon.
      </p>
    )
  }

  return (
    <section className="flex flex-col gap-3" aria-labelledby="level-choice">
      <h2
        id="level-choice"
        className="text-tertiary text-[13px] font-bold tracking-[0.06em] uppercase"
      >
        Niveau de la séance
      </h2>
      <div className="flex flex-wrap gap-1.5">
        {levels.map((level) => {
          const active = level.id === selected.id
          return (
            <button
              key={level.id}
              type="button"
              onClick={() => setChosenId(level.id)}
              aria-pressed={active}
              aria-label={`Niveau ${level.position}`}
              className={cn(
                'flex h-[38px] min-w-[38px] items-center justify-center rounded-[12px] border-[1.5px] px-2.5 text-sm font-bold',
                active
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-chip text-muted-foreground border-border',
              )}
            >
              {level.position}
            </button>
          )
        })}
      </div>
      <p className="text-tertiary text-[13px]">
        Au-delà du niveau {levels[levels.length - 1].position}, un participant n&apos;y
        est pas encore arrivé.
      </p>

      <button
        type="button"
        onClick={() => {
          setError(null)
          startTransition(async () => {
            const result = await startRoom(roomId, selected.id)
            // En cas de succes, rien a faire : le salon passe 'running', et
            // la relecture en direct change l'ecran pour tout le monde.
            if (result.error) setError(result.error)
          })
        }}
        disabled={pending}
        className="bg-primary text-primary-foreground mt-1 rounded-full py-[18px] text-center text-[17px] font-extrabold shadow-[var(--glow-action)] disabled:opacity-50"
      >
        {pending ? 'Lancement…' : `Lancer le niveau ${selected.position}`}
      </button>
      {error ? (
        <p className="text-fail text-center text-[13px] font-semibold" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  )
}

function LeaveButton({ roomId }: { roomId: string }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  return (
    <div className="mt-auto flex flex-col gap-1.5">
      <button
        type="button"
        onClick={() => {
          setError(null)
          startTransition(async () => {
            const result = await leaveRoom(roomId)
            if (result.error) {
              setError(result.error)
              return
            }
            router.push('/')
          })
        }}
        disabled={pending}
        className="border-border-strong text-muted-foreground w-full rounded-full border-[1.5px] py-4 text-[16px] font-semibold disabled:opacity-50"
      >
        Quitter le salon
      </button>
      {error ? (
        <p className="text-fail text-center text-[13px] font-semibold">{error}</p>
      ) : null}
    </div>
  )
}

/** Seance terminee : il ne reste qu'a rentrer. */
function Finished({ gridName }: { gridName: string }) {
  return (
    <main className="gutter mx-auto flex min-h-dvh w-full max-w-[520px] flex-col justify-center gap-5 py-10 text-center">
      <p className="text-tertiary text-[13px] font-bold tracking-[0.1em] uppercase">
        {gridName}
      </p>
      <h1 className="text-[24px] font-extrabold">La séance est terminée</h1>
      <Link
        href="/"
        className="border-border-strong rounded-full border-[1.5px] py-4 text-[16px] font-bold"
      >
        Retour à l&apos;accueil
      </Link>
    </main>
  )
}
