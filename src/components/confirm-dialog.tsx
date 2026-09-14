'use client'

/**
 * Confirmation modale.
 *
 * Remplace `window.confirm` de la maquette : le dialogue natif casse la charte
 * et, sur mobile, sort l'utilisateur du mode plein ecran de la seance.
 *
 * L'action destructrice est a droite mais n'a pas le focus initial : c'est
 * l'annulation qui l'a, pour qu'une validation au clavier ne detruise rien.
 */
export function ConfirmDialog({
  title,
  description,
  confirmLabel,
  cancelLabel = 'Annuler',
  onConfirm,
  onCancel,
}: {
  title: string
  description: string
  confirmLabel: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-20 flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center"
    >
      <div className="bg-card border-border w-full max-w-[420px] rounded-[20px] border p-5">
        <h2 className="text-lg font-bold">{title}</h2>
        <p className="text-muted-foreground mt-2 text-sm">{description}</p>

        <div className="mt-5 flex flex-col gap-2.5 sm:flex-row-reverse">
          <button
            type="button"
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground flex-1 rounded-full py-3 text-sm font-extrabold"
          >
            {confirmLabel}
          </button>
          <button
            type="button"
            onClick={onCancel}
            autoFocus
            className="border-border-strong flex-1 rounded-full border py-3 text-sm font-semibold"
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
