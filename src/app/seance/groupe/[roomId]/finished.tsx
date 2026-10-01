import Link from 'next/link'

/** Seance terminee : il ne reste qu'a rentrer. */
export function Finished({ gridName }: { gridName: string }) {
  return (
    <main className="gutter mx-auto flex min-h-dvh w-full max-w-[520px] flex-col justify-center gap-5 py-10 text-center">
      <p className="text-tertiary text-[13px] font-bold tracking-[0.1em] uppercase">
        {gridName}
      </p>
      <h1 className="text-[24px] font-extrabold">La séance est terminée</h1>
      <Link
        href="/"
        className="border-border-strong rounded-full border-[1.5px] py-4 text-[16px] font-bold"
      >
        Retour à l&apos;accueil
      </Link>
    </main>
  )
}
