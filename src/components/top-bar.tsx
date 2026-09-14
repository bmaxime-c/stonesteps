'use client'

import { UserRound } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { cn } from '@/lib/utils'

/**
 * Barre superieure collante, unique niveau de navigation persistante.
 *
 * Trois destinations : Accueil, Grilles et Stats. « Grilles » est le menu
 * d'edition : on ne modifie plus une grille depuis l'ecran qui sert a lancer
 * une seance. C'est un ecart assume au handoff, qui n'en prevoyait que deux ;
 * le constructeur et la bibliotheque restent des sous-ecrans, avec un retour
 * explicite.
 *
 * Seance et resume masquent cette barre entierement — ils vivent hors du
 * groupe de routes qui la monte.
 *
 * L'icone de droite mene au compte, ou vit aussi la deconnexion. Ce n'est pas
 * une destination de plus : c'est un reglage, pas un ecran ou l'on travaille.
 */

const TABS = [
  { href: '/', label: 'Accueil' },
  { href: '/grilles', label: 'Grilles' },
  { href: '/stats', label: 'Stats' },
] as const

export function TopBar() {
  const pathname = usePathname()

  return (
    <header className="border-border sticky top-0 z-10 border-b bg-[rgb(6_18_12/0.82)] backdrop-blur-[14px]">
      <div className="gutter mx-auto flex max-w-[1040px] items-center justify-between gap-4 py-3">
        <Link href="/" className="flex min-w-0 items-center gap-2.5">
          <span className="bg-primary text-primary-foreground flex size-[30px] shrink-0 items-center justify-center rounded-[9px] text-[13px] font-extrabold shadow-[0_0_18px_rgb(0_255_135/0.45)]">
            SS
          </span>
          <span className="truncate text-base font-bold tracking-[-0.01em]">
            StoneSteps
          </span>
        </Link>

        <nav className="flex shrink-0 items-center gap-1.5">
          {TABS.map((tab) => {
            const active =
              tab.href === '/' ? pathname === '/' : pathname.startsWith(tab.href)
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'rounded-full px-4 py-2.5 text-sm font-semibold whitespace-nowrap transition-colors',
                  active
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {tab.label}
              </Link>
            )
          })}

          <Link
            href="/compte"
            aria-label="Mon compte"
            title="Mon compte"
            aria-current={pathname === '/compte' ? 'page' : undefined}
            className={cn(
              'hover:bg-chip focus-visible:ring-ring/50 flex size-9 items-center justify-center rounded-full transition-colors outline-none focus-visible:ring-3',
              pathname === '/compte'
                ? 'bg-chip text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <UserRound className="size-4" />
          </Link>
        </nav>
      </div>
    </header>
  )
}
