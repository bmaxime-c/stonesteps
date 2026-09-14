import type { ReactNode } from 'react'

/** Carte d'etat vide, a la meme forme que les cartes de contenu. */
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="bg-card border-border flex flex-col items-center gap-2 rounded-[20px] border px-6 py-12 text-center">
      <p className="text-lg font-bold">{title}</p>
      <p className="text-muted-foreground max-w-md text-sm text-balance">{description}</p>
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  )
}
