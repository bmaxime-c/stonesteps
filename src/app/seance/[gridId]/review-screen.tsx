'use client'

import { CorrectionControl, type Correction } from './correction-control'

/**
 * Correction d'une serie chronometree que ne suit aucun repos.
 *
 * Derniere serie du niveau, ou repos desactive sur la grille : sans cette
 * etape, le tap sur « Termine » ferait foi sans appel. On s'arrete donc le
 * temps de rectifier, et c'est l'utilisateur qui repart.
 */
export function ReviewScreen({
  correction,
  continueLabel,
  onContinue,
}: {
  correction: Correction
  continueLabel: string
  onContinue: () => void
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-[clamp(14px,3dvh,24px)]">
      <CorrectionControl correction={correction} />

      <button
        type="button"
        onClick={onContinue}
        className="bg-primary text-primary-foreground w-full max-w-[280px] shrink-0 rounded-full py-[clamp(14px,2.4dvh,18px)] text-[clamp(16px,2.3dvh,18px)] font-extrabold shadow-[0_0_30px_rgb(0_255_135/0.4)]"
      >
        {continueLabel}
      </button>
    </div>
  )
}
