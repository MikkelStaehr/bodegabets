import Link from 'next/link'

/**
 * Pitch-banner der vises i gameroom for free-event spilrum (fx VM 2026)
 * når den loggede-in bruger IKKE har aktivt medlemskab. Forklarer hvad
 * brugeren får adgang til ved at konvertere til betalende medlem efter
 * eventet — placeret over hoved-indholdet så den ses uden at fylde
 * vej for selve spilrummet.
 */
export default function FreeEventPitchBanner() {
  return (
    <div className="bg-cream border-b border-warm-border">
      <div className="max-w-[680px] mx-auto px-5 py-5">
        <div className="flex items-start gap-4">
          <div className="shrink-0 w-10 h-10 rounded-sm bg-forest flex items-center justify-center text-cream font-condensed font-bold text-base">
            ★
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-condensed text-[10px] uppercase tracking-[0.14em] text-warm-gray mb-1">
              Du spiller gratis
            </p>
            <h3 className="font-display text-lg font-bold text-ink leading-tight mb-2">
              Fortsæt mod vennerne efter VM
            </h3>
            <p className="font-body text-sm text-warm-gray leading-snug mb-3">
              Bliv medlem for €1/måned og lås op for hele Bodega Bets:
              ugentlige spilrunder i 20 europæiske ligaer, mesterskabet,
              cykling-fantasy under Tour og Vuelta, og rivalopgør med vennegruppen.
            </p>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/subscribe"
                className="inline-flex items-center px-4 py-2 rounded-sm bg-forest text-cream font-condensed font-bold text-xs uppercase tracking-[0.08em] hover:bg-forest-light transition-colors"
              >
                Bliv medlem · €1/mnd
              </Link>
              <Link
                href="/"
                className="inline-flex items-center px-4 py-2 rounded-sm border border-warm-border text-warm-gray font-condensed font-semibold text-xs uppercase tracking-[0.08em] hover:border-ink hover:text-ink transition-colors"
              >
                Læs mere
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
