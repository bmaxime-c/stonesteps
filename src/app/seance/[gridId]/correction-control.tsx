'use client'

import { STATUS_LABEL, STATUS_TEXT } from '@/components/status-pill'
import type { TimerMode } from '@/lib/grids/model'
import type { SetStatus } from '@/lib/session/model'

import { StepButton } from './set-runner'

/** Resultat de la serie chronometree qui vient de finir, encore rectifiable. */
export type Correction = {
  mode: Exclude<TimerMode, 'none'>
  value: number
  /** En 'strict', la limite : au-dela, la serie echoue de toute facon. */
  max: number | null
  status: SetStatus
  onChange: (seconds: number) => void
}

/**
 * Meme parti que le compteur de reps : le statut se lit a la couleur du
 * chiffre, qui suit la correction en direct.
 */
export function CorrectionControl({ correction }: { correction: Correction }) {
  const { mode, value, max, status, onChange } = correction

  return (
    <section
      aria-label="Corriger la série précédente"
      className="bg-card border-border flex w-full max-w-[340px] shrink-0 flex-col items-center gap-[clamp(6px,1.2dvh,10px)] rounded-2xl border px-4 py-[clamp(10px,1.8dvh,16px)]"
    >
      <p className="text-muted-foreground text-[clamp(12px,1.6dvh,13px)] font-semibold">
        {mode === 'minimal' ? 'Temps réellement tenu' : 'Série finie en'}
      </p>

      <div className="flex items-center gap-[clamp(14px,4vw,22px)]">
        <StepButton
          label="Retirer une seconde"
          disabled={value <= 0}
          onClick={() => onChange(value - 1)}
        >
          &minus;
        </StepButton>

        <div className={`figure-timer min-w-[96px] text-center ${STATUS_TEXT[status]}`}>
          {value}s
        </div>
        <span className="sr-only" aria-live="polite">
          {STATUS_LABEL[status]}
        </span>

        <StepButton
          label="Ajouter une seconde"
          disabled={max !== null && value >= max}
          onClick={() => onChange(value + 1)}
        >
          +
        </StepButton>
      </div>
    </section>
  )
}
