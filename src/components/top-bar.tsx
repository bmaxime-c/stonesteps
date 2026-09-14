'use client'

import { LogOut } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { signOut } from '@/app/(auth)/actions'
import { cn } from '@/lib/utils'

/**
 * Barre superieure collante, unique niveau de navigation persistante.
 *
 * Deux destinations seulement : Accueil et Stats. Detail de grille,
 * constructeur et bibliotheque sont des sous-ecrans d'Accueil, avec un retour
 * explicite plutot qu'un onglet. Seance et resume masquent cette barre
 * entierement — ils vivent hors du groupe de routes qui la monte.
 */

const TABS = [
  { href: '/', label: 'Accueil' },
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

          <form action={signOut}>
            <button
              type="submit"
              aria-label="Se déconnecter"
              title="Se déconnecter"
              className="text-muted-foreground hover:text-foreground hover:bg-chip focus-visible:ring-ring/50 flex size-9 items-center justify-center rounded-full transition-colors outline-none focus-visible:ring-3"
            >
              <LogOut className="size-4" />
            </button>
          </form>
        </nav>
      </div>
    </header>
  )
}
