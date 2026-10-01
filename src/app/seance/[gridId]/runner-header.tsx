'use client'

import { X } from 'lucide-react'

import { progressRatio, type SetStep } from '@/lib/session/steps'

/**
 * Haut de l'ecran de seance, commun au solo et au groupe.
 *
 * Niveau, exercice et serie en cours, barre de progression, puis l'exercice
 * montre et son image. Les deux coureurs composent les memes ecrans : l'en-tete
 * ne doit pas diverger de l'un a l'autre.
 *
 * `step` situe la serie dans le niveau ; `shown` est l'exercice qu'on montre,
 * celui de la serie suivante pendant le repos. `done` series closes sur
 * `total` remplissent la barre, qui avance apres chaque serie, pas pendant.
 */
export function RunnerHeader({
  levelNumber,
  levelCount,
  step,
  shown,
  done,
  total,
  onExit,
}: {
  levelNumber: number
  levelCount: number
  step: SetStep
  shown: SetStep
  done: number
  total: number
  /** Absent : pas de croix de sortie. */
  onExit?: () => void
}) {
  return (
    <>
      <header className="flex shrink-0 items-center justify-between gap-3 pb-[clamp(10px,2dvh,16px)]">
        <div className="flex min-w-0 flex-wrap items-center gap-2.5">
          <span className="bg-success/16 text-success rounded-full px-3 py-[5px] text-[12.5px] font-extrabold whitespace-nowrap">
            Niveau {levelNumber}/{levelCount}
          </span>
          <span className="text-[13px] font-semibold tracking-[0.04em] whitespace-nowrap text-white/60 uppercase">
            Exercice {step.exerciseNumber}/{step.exerciseCount} · Série {step.setNumber}/
            {step.setCount}
          </span>
        </div>

        {onExit ? (
          <button
            type="button"
            aria-label="Quitter la séance"
            onClick={onExit}
            className="flex size-[34px] shrink-0 items-center justify-center rounded-full bg-white/12"
          >
            <X className="size-3.5" />
          </button>
        ) : null}
      </header>

      {/* Progression sur le total de series du niveau, pas sur les exercices. */}
      <div className="mb-[clamp(14px,3dvh,28px)] h-1 shrink-0 overflow-hidden rounded-sm bg-white/12">
        <div
          className="bg-primary h-full transition-[width] duration-300"
          style={{ width: `${progressRatio(done, total) * 100}%` }}
        />
      </div>

      <p className="mb-[clamp(6px,1.5dvh,12px)] shrink-0 text-center text-[clamp(20px,3.4dvh,26px)] font-bold tracking-[-0.01em]">
        {shown.exerciseName}
      </p>

      {/* L'image guide le geste. Pendant le repos, c'est celle de la serie qui
          vient : on s'y prepare. Sa hauteur suit l'ecran pour que la seance
          tienne toujours sans defilement. */}
      {shown.exerciseImageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={shown.exerciseImageUrl}
          alt={`Illustration : ${shown.exerciseName}`}
          className="bg-inset mx-auto mb-[clamp(6px,1.5dvh,12px)] h-[clamp(64px,16dvh,160px)] w-auto max-w-full shrink-0 rounded-[14px] object-contain"
        />
      ) : null}
    </>
  )
}
