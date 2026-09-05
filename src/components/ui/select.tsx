import * as React from 'react'

import { cn } from 'cn'

/**
 * `<select>` natif, habille comme les autres champs.
 *
 * Volontairement natif plutot qu'un composant a liste deroulante
 * personnalisee : sur mobile, il ouvre le selecteur du systeme, plus rapide a
 * manipuler d'une main et accessible sans effort.
 */
function Select({ className, ...props }: React.ComponentProps<'select'>) {
  return (
    <select
      data-slot="select"
      className={cn(
        'border-input bg-background text-foreground flex h-9 w-full rounded-lg border px-3 py-1 text-sm shadow-xs transition-colors outline-none',
        'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-3',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'aria-invalid:border-destructive aria-invalid:ring-destructive/20',
        className,
      )}
      {...props}
    />
  )
}

export { Select }
