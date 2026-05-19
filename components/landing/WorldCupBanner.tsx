import Link from 'next/link'

type Props = {
  /** Display-name for kampagnen (typisk tournaments.name, fx "FIFA VM 2026") */
  eventName: string
}

/**
 * Tryout-kampagne-banner (fx VM 2026). Vises kun når der findes mindst én
 * sæson med is_free_event=true. CTA fører anonyme brugere gennem signup →
 * subscribe-choice → /games/fodbold/new (hvor sæson-vælgeren er filtreret
 * til kun den/de free-event-sæsoner). Brugere kan oprette deres eget VM-
 * spilrum og invitere venner — eller joine et eksisterende via invite-kode.
 */
export default function WorldCupBanner({ eventName }: Props) {
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
              {eventName}
            </h2>
            <p
              className="font-body text-base lg:text-lg max-w-2xl"
              style={{ color: '#1a3329' }}
            >
              VM i USA, Canada og Mexico starter snart. Opret en gratis konto,
              lav dit eget spilrum med vennerne — eller join et eksisterende
              via invitationskode. Du kan til hver en tid opgradere til fuldt
              medlemskab for €1/måned.
            </p>
          </div>
          <div className="shrink-0 flex flex-col gap-3 w-full lg:w-auto">
            <Link
              href="/register?redirect=/subscribe"
              className="inline-flex items-center justify-center px-6 py-3.5 rounded-sm bg-forest text-cream font-condensed font-bold text-sm uppercase tracking-[0.08em] hover:bg-forest-light transition-colors min-h-[44px]"
            >
              Opret gratis konto
            </Link>
            <Link
              href="/login"
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
