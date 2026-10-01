import Link from 'next/link'
import type { ReactNode } from 'react'

import { AddGridButton } from '@/app/(app)/grilles/follow-buttons'

/**
 * Ecrans de la porte du salon : ce qu'on voit quand on n'a pas pu entrer.
 *
 * Plein ecran comme le salon lui-meme, sans barre : la seule sortie est le
 * retour a l'accueil.
 */

function Gate({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="gutter mx-auto flex min-h-dvh w-full max-w-[520px] flex-col justify-center gap-5 py-10 text-center">
      <p className="text-tertiary text-[13px] font-bold tracking-[0.1em] uppercase">
        Séance à plusieurs
      </p>
      <h1 className="text-[24px] font-extrabold">{title}</h1>
      {children}
      <Link
        href="/"
        className="border-border-strong mt-2 rounded-full border-[1.5px] py-4 text-[16px] font-bold"
      >
        Retour à l&apos;accueil
      </Link>
    </main>
  )
}

/**
 * Entree refusee : salon lance, complet, introuvable, ou version differente.
 *
 * Le message vient de l'action d'entree, qui seule sait pourquoi : l'ecran se
 * contente de le montrer.
 */
export function RoomRefusal({ message }: { message: string }) {
  return (
    <Gate title="Impossible d'entrer dans le salon">
      <p className="bg-inset border-border text-muted-foreground rounded-[16px] border px-4 py-3.5 text-[14px]">
        {message}
      </p>
    </Gate>
  )
}

/**
 * Grille publique qu'on ne suit pas encore : on l'adopte, et l'on entre.
 *
 * Adopter rafraichit la page ; le rendu serveur rejoue alors l'entree, qui
 * passe cette fois, ou bute sur un autre motif qu'il affichera.
 */
export function AdoptToJoin({
  gridId,
  gridName,
  ownerName,
}: {
  gridId: string
  gridName: string
  ownerName: string | null
}) {
  return (
    <Gate title={gridName}>
      <p className="text-muted-foreground text-[14px]">
        Ce salon joue une grille de {ownerName ?? 'un autre utilisateur'} que tu ne suis
        pas encore. Ajoute-la à tes grilles pour rejoindre la séance : tu y joueras ta
        propre progression.
      </p>
      <div className="flex justify-center">
        <AddGridButton gridId={gridId} />
      </div>
    </Gate>
  )
}
