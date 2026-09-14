import type { Metadata, Viewport } from 'next'
import { DM_Sans } from 'next/font/google'

import { ServiceWorkerRegister } from '@/components/service-worker-register'
import { Toaster } from '@/components/ui/sonner'

import './globals.css'

// Famille unique, sans-serif geometrique : c'est celle de la maquette.
const dmSans = DM_Sans({
  variable: '--font-dm-sans',
  subsets: ['latin'],
  display: 'swap',
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
  // Theme unique sombre : une seule valeur, celle du fond de page.
  themeColor: '#06120C',
  // L'app est utilisee en salle, telephone en main : on evite le zoom
  // accidentel entre deux series sans bloquer l'accessibilite.
  initialScale: 1,
  width: 'device-width',
  viewportFit: 'cover',
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    // `dark` est pose en dur : l'app n'a pas de mode clair, mais les
    // primitives shadcn portent des variantes `dark:` qu'il faut activer.
    <html lang="fr" className={`dark ${dmSans.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        {children}
        <Toaster />
        <ServiceWorkerRegister />
      </body>
    </html>
  )
}
