'use client'

import { useTheme } from 'next-themes'
import { useSyncExternalStore } from 'react'

import { Button } from '@/components/ui/button'

const LABELS: Record<string, string> = {
  light: 'Theme clair',
  dark: 'Theme sombre',
  system: 'Theme du systeme',
}

const SYMBOLS: Record<string, string> = {
  light: '☀',
  dark: '☾',
  system: '◐',
}

const ORDER = ['system', 'light', 'dark'] as const

/**
 * Vrai une fois l'hydratation faite.
 *
 * useSyncExternalStore plutot qu'un useState pose dans un effet : l'instantane
 * serveur vaut false, celui du client true, et React fait la bascule sans
 * rendu en cascade.
 */
const neverChanges = () => () => {}

function useHydrated(): boolean {
  return useSyncExternalStore(
    neverChanges,
    () => true,
    () => false,
  )
}

/**
 * Bascule clair / sombre / systeme, en cycle sur un seul bouton.
 *
 * Le rendu est retarde jusqu'au montage : cote serveur, le theme resolu est
 * inconnu, et afficher un symbole avant de le savoir produirait une
 * divergence d'hydratation puis un clignotement.
 */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const mounted = useHydrated()

  const current =
    theme && ORDER.includes(theme as (typeof ORDER)[number]) ? theme : 'system'
  const next =
    ORDER[(ORDER.indexOf(current as (typeof ORDER)[number]) + 1) % ORDER.length]

  return (
    <Button
      type="button"
      size="icon-sm"
      variant="ghost"
      onClick={() => setTheme(next)}
      aria-label={
        mounted
          ? `${LABELS[current]}. Basculer vers : ${LABELS[next]}`
          : 'Changer de theme'
      }
      title={mounted ? LABELS[current] : undefined}
    >
      <span aria-hidden>{mounted ? SYMBOLS[current] : '◐'}</span>
    </Button>
  )
}
