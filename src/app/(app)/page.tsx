import { EmptyState } from '@/components/empty-state'
import { ScreenHeader } from '@/components/screen-header'

export default function HomePage() {
  return (
    <main className="gutter mx-auto flex w-full max-w-[1040px] flex-col gap-[22px] pt-[clamp(20px,3vw,36px)] pb-[72px]">
      <ScreenHeader eyebrow="Aujourd'hui" title="Mes grilles" />
      <EmptyState
        title="Aucune grille pour l'instant"
        description="Une grille est une suite de niveaux : on valide un niveau en reussissant toutes ses series, et le suivant se debloque."
      />
    </main>
  )
}
