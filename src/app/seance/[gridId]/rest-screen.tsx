'use client'

/**
 * Repos entre deux series.
 *
 * Meme mode plein ecran que la seance, en-tete comprise : on reste dans le
 * meme ecran, seul le corps change. Le compte a rebours est en cyan, la seule
 * couleur qui ne signifie pas un statut de serie — un repos n'est ni reussi ni
 * echoue.
 */
export function RestScreen({
  remaining,
  nextExerciseName,
  nextSetLabel,
  onSkip,
}: {
  remaining: number
  nextExerciseName: string
  nextSetLabel: string
  onSkip: () => void
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6">
      <p className="text-live text-[13px] font-bold tracking-[0.1em] uppercase">Repos</p>

      <p
        className="text-live text-[104px] leading-none font-extrabold tabular-nums"
        style={{ textShadow: '0 0 40px rgb(34 225 255 / 0.45)' }}
        aria-live="polite"
      >
        {remaining}s
      </p>

      <p className="text-muted-foreground text-center text-[15px]">
        Prochaine série : {nextExerciseName} · {nextSetLabel}
      </p>

      <button
        type="button"
        onClick={onSkip}
        className="border-border-strong w-full max-w-[280px] rounded-full border-[1.5px] py-[18px] text-lg font-bold"
      >
        Passer le repos
      </button>
    </div>
  )
}
