import type { Metadata } from 'next'

import { EmptyState } from '@/components/empty-state'
import { ScreenHeader } from '@/components/screen-header'

export const metadata: Metadata = { title: 'Statistiques' }

export default function StatsPage() {
  return (
    <main className="gutter mx-auto flex w-full max-w-[1040px] flex-col gap-[22px] pt-[clamp(20px,3vw,36px)] pb-[72px]">
      <ScreenHeader eyebrow="Progression" title="Statistiques" />
      <EmptyState
        title="Aucune seance enregistree"
        description="Les statistiques se remplissent a la fin de ta premiere seance."
      />
    </main>
  )
}
