import type { Metadata } from 'next'

import { EmptyState } from '@/components/empty-state'
import { ScreenHeader } from '@/components/screen-header'
import { loadSessions } from '@/lib/stats/queries'

import { StatsBoard } from './stats-board'

export const metadata: Metadata = { title: 'Statistiques' }

export default async function StatsPage() {
  const sessions = await loadSessions()

  if (sessions.length === 0) {
    return (
      <main className="gutter mx-auto flex w-full max-w-[1040px] flex-col gap-[22px] pt-[clamp(20px,3vw,36px)] pb-[72px]">
        <ScreenHeader eyebrow="Progression" title="Statistiques" />
        <EmptyState
          title="Aucune séance enregistrée"
          description="Les statistiques se remplissent à la fin de ta première séance."
        />
      </main>
    )
  }

  // Le jour de reference vient du serveur : la grille de regularite doit se
  // decouper au meme endroit d'un rendu a l'autre.
  return <StatsBoard sessions={sessions} today={new Date().toISOString()} />
}
