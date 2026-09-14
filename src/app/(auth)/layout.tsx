/**
 * Coquille des ecrans de connexion et d'inscription.
 *
 * Pas de barre de navigation : tant qu'il n'y a pas de session, il n'y a
 * nulle part ou aller. Le bloc de marque tient lieu de repere.
 */
// Ce layout couvre deux routes (/login et /signup) : LayoutProps est indexe
// par route unique et ne sait pas les representer toutes les deux.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="gutter flex flex-1 flex-col items-center justify-center py-10">
      <div className="flex w-full max-w-[400px] flex-col gap-7">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="bg-primary text-primary-foreground flex size-12 items-center justify-center rounded-[16px] text-lg font-extrabold shadow-[var(--glow-action)]">
            SS
          </span>
          <div>
            <p className="text-xl font-bold tracking-[-0.02em]">StoneSteps</p>
            <p className="text-tertiary mt-1 text-sm text-balance">
              Une grille de niveaux, aucune concession : on ne monte d&apos;un cran que
              lorsque toutes les series sont validees.
            </p>
          </div>
        </div>
        {children}
      </div>
    </main>
  )
}
