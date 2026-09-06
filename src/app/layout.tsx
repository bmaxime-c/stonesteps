import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'

import { ServiceWorkerRegister } from '@/components/service-worker-register'
import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from '@/components/ui/sonner'

import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: {
    default: 'StoneSteps',
    template: '%s · StoneSteps',
  },
  description:
    'Progression en callisthenie par niveaux : construis ta grille, valide tes seances, suis ta progression.',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'StoneSteps',
    statusBarStyle: 'black-translucent',
  },
}

export const viewport: Viewport = {
  // Deux valeurs : la barre du navigateur suit le theme au lieu de rester
  // sombre sur une page claire.
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fafaf9' },
    { media: '(prefers-color-scheme: dark)', color: '#0c0a09' },
  ],
  // L'app est utilisee en salle, telephone en main : on evite le zoom
  // accidentel entre deux series sans bloquer l'accessibilite.
  initialScale: 1,
  width: 'device-width',
  viewportFit: 'cover',
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="fr"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      // next-themes ecrit la classe de theme avant l'hydratation : la
      // divergence est attendue et sans consequence.
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col">
        <ThemeProvider>
          {children}
          <Toaster />
          <ServiceWorkerRegister />
        </ThemeProvider>
      </body>
    </html>
  )
}
