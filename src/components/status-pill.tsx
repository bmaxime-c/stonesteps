import type { SetStatus } from '@/lib/session/model'
import { cn } from '@/lib/utils'

/**
 * Pastille de statut.
 *
 * Les neons sont clairs : le texte pose dessus est une encre sombre, jamais du
 * blanc. Les classes sont ecrites en toutes lettres — Tailwind lit le source,
 * une classe assemblee a l'execution ne serait jamais generee.
 */
const STYLES: Record<SetStatus | 'progress', { label: string; className: string }> = {
  success: {
    label: 'Réussi',
    className: 'bg-success text-ink-neon shadow-[0_0_26px_rgb(0_255_135/0.4)]',
  },
  surpass: {
    label: 'Dépassé',
    className: 'bg-surpass text-ink-neon shadow-[0_0_26px_rgb(212_255_63/0.4)]',
  },
  fail: {
    label: 'Échoué',
    className: 'bg-fail text-ink-rose shadow-[0_0_26px_rgb(255_45_111/0.4)]',
  },
  progress: {
    label: 'En cours',
    className: 'bg-live text-ink-neon shadow-[0_0_26px_rgb(34_225_255/0.4)]',
  },
}

/** `null` affiche l'etat neutre « En cours » d'une serie strict en plein effort. */
export function StatusPill({
  status,
  size = 'lg',
  className,
}: {
  status: SetStatus | null
  size?: 'sm' | 'lg'
  className?: string
}) {
  const style = STYLES[status ?? 'progress']

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-extrabold',
        size === 'lg' ? 'px-[22px] py-2 text-[15px]' : 'px-2.5 py-[5px] text-[11px]',
        style.className,
        className,
      )}
    >
      {style.label}
    </span>
  )
}

/** Couleur du statut, pour un chiffre ou un trait qui tient seul sur le fond. */
export const STATUS_TEXT: Record<SetStatus | 'progress', string> = {
  success: 'text-success',
  surpass: 'text-surpass',
  fail: 'text-fail',
  progress: 'text-live',
}

/** Meme chose, en valeur brute, pour un attribut SVG. */
export const STATUS_STROKE: Record<SetStatus | 'progress', string> = {
  success: 'var(--success)',
  surpass: 'var(--surpass)',
  fail: 'var(--fail)',
  progress: 'var(--live)',
}
