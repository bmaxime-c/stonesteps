'use client'

import { ThemeProvider as NextThemesProvider } from 'next-themes'
import type { ComponentProps } from 'react'

/**
 * Fournisseur de theme.
 *
 * `attribute="class"` pose la classe `.dark` sur <html>, ce que le theme
 * attend. `defaultTheme="system"` fait que l'application est sombre en salle
 * sans rien demander, tout en laissant le selecteur contredire le systeme.
 *
 * next-themes injecte un script avant le rendu : le theme est applique avant
 * la premiere peinture, sans l'eclair blanc caracteristique d'une bascule
 * faite apres coup.
 */
export function ThemeProvider({
  children,
  ...props
}: ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      {...props}
    >
      {children}
    </NextThemesProvider>
  )
}
