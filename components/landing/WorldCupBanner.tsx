import Link from 'next/link'

type Props = {
  gameId: number
  gameName: string
}

/**
 * Banner der promoverer aktive free-event spilrum (fx VM 2026).
 * Vises kun hvis der findes et game med is_free_event=true og status='active'.
 * Anonyme brugere sendes til /register med ?redirect=/games/<id> som lander
 * dem direkte i spilrummet efter signup (paywall springes over via free-event-
 * undtagelse i proxy.ts).
 */
export default function WorldCupBanner({ gameId, gameName }: Props) {
  return (
    <section className="bg-gold relative overflow-hidden">
      <div className="max-w-5xl mx-auto px-6 lg:px-8 py-10 lg:py-14">
        <div className="flex flex-col lg:flex-row items-start lg:items-center gap-6 lg:gap-10">
          <div className="flex-1">
            <p
              className="font-condensed text-xs uppercase tracking-[0.18em] mb-3"
              style={{ color: '#1a3329' }}
            >
              Engangs-event · Gratis at spille
            </p>
            <h2
              className="font-display text-3xl lg:text-5xl font-bold leading-tight mb-3"
              style={{ color: '#1a1a1a' }}
            >
              {gameName}
            </h2>
            <p
              className="font-body text-base lg:text-lg max-w-2xl"
              style={{ color: '#1a3329' }}
            >
              VM i USA, Canada og Mexico starter snart. Spil mod vennerne uden medlemskab —
              opret en gratis konto, lav dine bets, og se hvem der bedst rammer kampene.
            </p>
          </div>
          <div className="shrink-0 flex flex-col gap-3 w-full lg:w-auto">
            <Link
              href={`/register?redirect=/games/${gameId}`}
              className="inline-flex items-center justify-center px-6 py-3.5 rounded-sm bg-forest text-cream font-condensed font-bold text-sm uppercase tracking-[0.08em] hover:bg-forest-light transition-colors min-h-[44px]"
            >
              Spil VM gratis
            </Link>
            <Link
              href={`/games/${gameId}`}
              className="inline-flex items-center justify-center px-6 py-2.5 rounded-sm border border-forest/40 text-forest font-condensed font-semibold text-xs uppercase tracking-[0.08em] hover:bg-forest/5 transition-colors"
            >
              Allerede oprettet? Log ind
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
