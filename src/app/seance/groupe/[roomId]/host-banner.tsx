/**
 * Bandeau discret qui annonce qu'on vient de prendre la main du salon.
 *
 * Pose par-dessus l'ecran, sans le decaler : la seance continue dessous, et
 * il disparait de lui-meme (useHostDuty).
 */
export function HostBanner() {
  return (
    <p
      role="status"
      className="bg-card border-border-strong text-foreground pointer-events-none fixed top-[calc(env(safe-area-inset-top)+12px)] left-1/2 z-40 -translate-x-1/2 rounded-full border px-4 py-2 text-[13px] font-semibold whitespace-nowrap"
    >
      Tu es maintenant l&apos;hôte
    </p>
  )
}
