import type { ReactNode } from 'react'

/**
 * En-tete d'ecran : surtitre discret, titre, et une action optionnelle a
 * droite qui passe sous le titre quand la largeur ne suffit plus.
 */
export function ScreenHeader({
  eyebrow,
  title,
  action,
}: {
  eyebrow?: string
  title: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow ? <p className="text-tertiary text-sm font-medium">{eyebrow}</p> : null}
        <h1 className="title-screen mt-0.5">{title}</h1>
      </div>
      {action}
    </div>
  )
}
