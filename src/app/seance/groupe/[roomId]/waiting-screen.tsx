'use client'

import {
  CorrectionControl,
  type Correction,
} from '@/app/seance/[gridId]/correction-control'
import { StatusPill } from '@/components/status-pill'
import type { MemberStatus } from '@/lib/session/group/run'

/**
 * Attente du groupe, une fois sa serie jouee et declaree.
 *
 * Remplace l'etape de correction du solo : c'est le moment de rectifier le
 * chrono, et chaque correction redeclare la serie tant que le groupe ne l'a
 * pas depassee.
 *
 * Des autres, on voit qui est la, qui a fini, et son statut. Jamais ses
 * valeurs : elles ne quittent pas son appareil.
 *
 * L'hote peut passer quand meme : les series non declarees seront comptees
 * echouees par leurs auteurs.
 */
export function WaitingScreen({
  others,
  correction,
  isHost,
  onForce,
  forcing = false,
}: {
  others: MemberStatus[]
  correction: Correction | null
  isHost: boolean
  onForce: () => void
  forcing?: boolean
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-[clamp(12px,2.4dvh,20px)]">
      <p className="text-muted-foreground text-center text-[clamp(15px,2.2dvh,17px)] font-semibold">
        Série terminée. En attente du groupe.
      </p>

      {correction ? <CorrectionControl correction={correction} /> : null}

      {others.length > 0 ? (
        <ul className="flex min-h-0 w-full max-w-[340px] flex-col gap-1.5 overflow-y-auto">
          {others.map((other) => (
            <li
              key={other.userId}
              className="bg-card border-border flex items-center gap-3 rounded-[14px] border px-3.5 py-2.5"
            >
              <p className="min-w-0 flex-1 truncate text-[14px] font-semibold">
                {other.name}
              </p>
              {other.declared ? (
                <StatusPill status={other.status} size="sm" className="shrink-0" />
              ) : other.present ? (
                // Statut neutre : il joue encore sa serie.
                <StatusPill status={null} size="sm" className="shrink-0" />
              ) : (
                <span className="text-tertiary text-[12px] font-semibold">Absent</span>
              )}
            </li>
          ))}
        </ul>
      ) : null}

      {isHost ? (
        <button
          type="button"
          onClick={onForce}
          disabled={forcing}
          className="border-border-strong w-full max-w-[280px] shrink-0 rounded-full border-[1.5px] py-[clamp(14px,2.4dvh,18px)] text-[clamp(16px,2.3dvh,18px)] font-bold disabled:opacity-50"
        >
          Passer quand même
        </button>
      ) : null}
    </div>
  )
}
