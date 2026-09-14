import { TopBar } from '@/components/top-bar'

/**
 * Groupe des ecrans qui portent la navigation persistante.
 *
 * Seance et resume n'en font volontairement pas partie : ce sont des modes
 * plein ecran dont on ne sort que par la croix ou par la derniere serie.
 */
export default function AppLayout({ children }: LayoutProps<'/'>) {
  return (
    <>
      <TopBar />
      <div className="flex flex-1 flex-col">{children}</div>
    </>
  )
}
