'use client'

import { StatusPill } from '@/components/status-pill'
import { countByStatus } from '@/lib/session/level'
import type { SetResult } from '@/lib/session/model'

/**
 * Resume de fin de seance.
 *
 * Le verdict de niveau ouvre l'ecran, avant tout le reste : c'est la seule
 * information qui change ce que fera l'utilisateur la prochaine fois. Rien
 * ne l'a annonce pendant la seance — une serie manquee affichait son statut,
 * et c'est tout.
 */
export function Summary({
  gridName,
  levelNumber,
  validated,
  results,
  saving,
  saveError,
  onRetry,
  onFinish,
}: {
  gridName: string
  levelNumber: number
  validated: boolean
  results: SetResult[]
  saving: boolean
  saveError: string | null
  onRetry: () => void
  onFinish: () => void
}) {
  const counts = countByStatus(results)

  const note = validated
    ? `Prochaine séance : niveau ${levelNumber + 1}`
    : `${counts.fail} série${counts.fail > 1 ? 's' : ''} manquée${counts.fail > 1 ? 's' : ''} — la prochaine séance repart du niveau ${levelNumber}`

  return (
    <main className="gutter mx-auto flex w-full max-w-[720px] flex-col gap-[18px] pt-[clamp(20px,3vw,36px)] pb-[72px]">
      <div className="text-center">
        <p className="text-tertiary text-[15px] font-semibold">Séance terminée</p>
        <p className="mt-1 text-[26px] font-extrabold">{gridName}</p>
      </div>

      {/* Encre sombre dans les deux cas : les deux fonds sont des neons clairs. */}
      <div
        className={
          validated
            ? 'bg-success text-ink-neon rounded-[20px] px-5 py-[22px] text-center shadow-[0_0_34px_rgb(0_255_135/0.35)]'
            : 'bg-fail text-ink-rose rounded-[20px] px-5 py-[22px] text-center shadow-[0_0_34px_rgb(255_45_111/0.3)]'
        }
      >
        <p className="text-2xl font-extrabold tracking-[-0.01em]">
          Niveau {levelNumber} {validated ? 'validé' : 'non validé'}
        </p>
        <p className="mt-1.5 text-sm font-semibold opacity-75">{note}</p>
      </div>

      <div className="flex gap-2.5">
        <Counter label="Réussies" value={counts.success} className="text-success" />
        <Counter label="Dépassées" value={counts.surpass} className="text-surpass" />
        <Counter label="Échouées" value={counts.fail} className="text-fail" />
      </div>

      <ul className="flex flex-col gap-2.5">
        {results.map((result) => (
          <li
            key={`${result.setIndex}-${result.levelSetId ?? 'x'}`}
            className="bg-card border-border flex items-center justify-between gap-3 rounded-[14px] border px-4 py-3.5"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">{result.exerciseName}</p>
              <p className="text-tertiary mt-px text-xs">
                {result.setLabel} · {result.actualValue}
                {result.unit === 's' ? 's' : ''} / {result.targetValue}
                {result.unit === 's' ? 's' : ' reps'}
              </p>
            </div>
            <StatusPill status={result.status} size="sm" className="shrink-0" />
          </li>
        ))}
      </ul>

      {saving ? (
        <p className="text-tertiary text-center text-sm">Enregistrement de la séance…</p>
      ) : null}

      {saveError ? (
        <div className="border-fail/40 bg-fail/10 flex flex-col items-center gap-3 rounded-[14px] border px-4 py-4 text-center">
          <p className="text-sm font-semibold">{saveError}</p>
          <button
            type="button"
            onClick={onRetry}
            className="border-border-strong rounded-full border px-4 py-2 text-sm font-semibold"
          >
            Réessayer
          </button>
        </div>
      ) : null}

      <button
        type="button"
        onClick={onFinish}
        className="border-border-strong mt-2 w-full rounded-full border-[1.5px] py-[18px] text-[17px] font-bold"
      >
        Retour à l&apos;accueil
      </button>
    </main>
  )
}

function Counter({
  label,
  value,
  className,
}: {
  label: string
  value: number
  className: string
}) {
  return (
    <div className="bg-card border-border flex-1 rounded-[16px] border p-3.5 text-center">
      <p className={`text-[22px] font-extrabold ${className}`}>{value}</p>
      <p className="text-tertiary mt-0.5 text-xs">{label}</p>
    </div>
  )
}
