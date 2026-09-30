'use client'

import { CorrectionControl, type Correction } from './correction-control'

/**
 * Repos entre deux series.
 *
 * Meme mode plein ecran que la seance, en-tete comprise : on reste dans le
 * meme ecran, seul le corps change. Le compte a rebours est en cyan, la seule
 * couleur qui ne signifie pas un statut de serie — un repos n'est ni reussi ni
 * echoue.
 *
 * Apres une serie chronometree, le repos porte aussi sa correction : le temps
 * saisi au tap sur « Termine » n'est qu'une premiere mesure.
 */
export function RestScreen({
  remaining,
  nextExerciseName,
  nextSetLabel,
  correction,
  onSkip,
}: {
  remaining: number
  nextExerciseName: string
  nextSetLabel: string
  correction: Correction | null
  onSkip: () => void
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-[clamp(14px,3dvh,24px)]">
      <p className="text-live text-[13px] font-bold tracking-[0.1em] uppercase">Repos</p>

      <p
        className="text-live text-[clamp(62px,15dvh,104px)] leading-none font-extrabold tabular-nums"
        style={{ textShadow: '0 0 40px rgb(34 225 255 / 0.45)' }}
        aria-live="polite"
      >
        {remaining}s
      </p>

      <p className="text-muted-foreground text-center text-[clamp(13px,1.8dvh,15px)]">
        Prochaine série : {nextExerciseName} · {nextSetLabel}
      </p>

      {correction ? <CorrectionControl correction={correction} /> : null}

      <button
        type="button"
        onClick={onSkip}
        className="border-border-strong w-full max-w-[280px] shrink-0 rounded-full border-[1.5px] py-[clamp(14px,2.4dvh,18px)] text-[clamp(16px,2.3dvh,18px)] font-bold"
      >
        Passer le repos
      </button>
    </div>
  )
}
