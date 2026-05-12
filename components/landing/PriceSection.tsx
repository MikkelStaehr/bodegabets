import Link from 'next/link'

/**
 * Editorial pris-afsnit med bodega-receipt. Genbrugt mellem / og /landing-v2.
 * Tunet til mobile-first: receipt og editorial-tekst stacker på små skærme.
 */

const RECEIPT_LINES = [
  { label: 'Cykling live-data', value: 'Grand Tours + monumenter' },
  { label: 'Fodbold live-data', value: '20 europæiske ligaer' },
  { label: 'Drift & vedligehold', value: 'ingen reklamer' },
] as const

export default function PriceSection() {
  return (
    <section className="bg-cream py-16 lg:py-32">
      <div className="max-w-5xl mx-auto px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-12 lg:gap-20 items-center">
          {/* Left: editorial statement */}
          <div>
            <span className="font-condensed font-semibold text-[11px] uppercase tracking-[0.14em] text-gold-dark">
              Én pris · ingen profit
            </span>

            <h2 className="mt-4 font-display font-black text-forest text-[40px] lg:text-[56px] leading-[0.95]">
              Du betaler til oplevelsen.
              <br />
              <em className="not-italic text-gold-dark italic">Ikke til udvikleren.</em>
            </h2>

            <p className="mt-6 font-body text-[16px] text-warm-gray leading-relaxed max-w-[460px]">
              Din krone går direkte til licenser på live etape-resultater,
              kamp-data og statistik fra 20 europæiske ligaer. Det er
              infrastrukturen der gør spillet levende — og uden den, intet
              Bodega Bets.
            </p>

            <Link
              href="/register"
              className="mt-10 inline-flex items-center justify-center px-8 py-4 bg-forest text-cream font-condensed font-bold text-[13px] uppercase tracking-widest rounded-sm hover:opacity-90 transition-opacity"
            >
              Kom i gang →
            </Link>
          </div>

          {/* Right: vintage receipt */}
          <div
            className="relative bg-cream-dark border-y border-dashed border-warm-border p-7 lg:p-8"
            style={{ fontFamily: "'Courier New', monospace" }}
          >
            {/* Receipt header */}
            <div className="text-center">
              <div className="font-condensed font-semibold text-[10px] uppercase tracking-[0.2em] text-warm-taupe">
                Bodega Bets · Sæson 25/26
              </div>
              <div className="mt-1 font-condensed text-[10px] uppercase tracking-[0.14em] text-warm-taupe/70">
                Medlemskab · månedlig
              </div>
            </div>

            <div className="my-5 border-t border-dashed border-warm-border" />

            <ul className="space-y-2.5 text-[12px] text-ink">
              {RECEIPT_LINES.map((line) => (
                <li
                  key={line.label}
                  className="flex items-baseline justify-between gap-3"
                >
                  <span className="truncate">{line.label}</span>
                  <span
                    className="flex-shrink-0 text-warm-taupe text-[11px] uppercase tracking-[0.08em]"
                    style={{ fontFamily: 'inherit' }}
                  >
                    {line.value}
                  </span>
                </li>
              ))}
            </ul>

            <div className="my-5 border-t border-dashed border-warm-border" />

            <div className="flex items-baseline justify-between">
              <span className="font-condensed font-bold text-[12px] uppercase tracking-[0.14em] text-forest">
                Total
              </span>
              <span className="flex items-baseline gap-1">
                <span className="font-display font-black text-forest text-[34px] leading-none">
                  €1.00
                </span>
                <span className="text-[11px] text-warm-taupe uppercase tracking-[0.08em]">
                  /måned
                </span>
              </span>
            </div>

            <div className="mt-3 flex items-baseline justify-between">
              <span className="font-condensed font-bold text-[11px] uppercase tracking-[0.14em] text-warm-taupe">
                Profit til ejer
              </span>
              <span className="font-display font-black text-warm-taupe text-[16px] leading-none">
                €0.00
              </span>
            </div>

            <div className="my-5 border-t border-dashed border-warm-border" />

            <p className="text-center text-[10px] uppercase tracking-[0.14em] text-warm-taupe/80">
              ingen er blevet rigere her
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
