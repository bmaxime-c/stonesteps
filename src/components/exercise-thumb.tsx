import { cn } from 'cn'

import { initials } from '@/lib/grids/describe'

/**
 * Vignette d'exercice : son image quand il en a une, ses initiales sinon.
 *
 * `<img>` et non `next/image` : l'image est deja reduite a l'envoi, et servie
 * telle quelle par le bucket public. L'optimiseur de Next n'aurait rien a y
 * gagner, et demanderait de declarer le domaine du projet Supabase.
 */
export function ExerciseThumb({
  name,
  imageUrl,
  className,
}: {
  name: string
  imageUrl: string | null
  className?: string
}) {
  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageUrl}
        alt=""
        loading="lazy"
        className={cn('bg-inset shrink-0 rounded-[10px] object-cover', className)}
      />
    )
  }

  return (
    <span
      className={cn(
        'bg-chip text-success flex shrink-0 items-center justify-center rounded-[10px] text-xs font-bold',
        className,
      )}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  )
}
