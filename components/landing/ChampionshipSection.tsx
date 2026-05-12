import Link from 'next/link'

/**
 * Flagship-treatment til Bodega Championship — auto-genererede runder af
 * rivalopgør og storkampe fra 20 europæiske ligaer. Genbrugt mellem / og
 * /landing-v2.
 */

const EXAMPLE_ROUND = [
  { name: 'El Clásico', code: 'RMA — BAR', dim: false },
  { name: 'Manchester Derby', code: 'MUN — MCI', dim: false },
  { name: 'Der Klassiker', code: 'BVB — BAY', dim: false },
  { name: 'Derby della Madonnina', code: 'INT — MIL', dim: false },
  { name: '+ 11 storkampe', code: '', dim: true },
] as const

export default function ChampionshipSection() {
  return (
    <section className="bg-forest py-16 lg:py-28">
      <div className="max-w-6xl mx-auto px-6 lg:px-8">
        <div className="relative bg-gradient-to-br from-gold/15 to-gold/5 border border-gold/40 rounded-sm p-6 lg:p-12 overflow-hidden">
          {/* Static BODEGA wordmark bottom-right */}
          <span
            aria-hidden
            className="absolute font-display font-black text-gold/[0.08] pointer-events-none select-none whitespace-nowrap leading-none"
            style={{
              fontSize: '120px',
              right: '-12px',
              bottom: '-32px',
            }}
          >
            BODEGA
          </span>

          <div className="relative grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-10 lg:gap-12">
            {/* Left column */}
            <div>
              <span className="inline-block font-condensed font-semibold text-[11px] uppercase tracking-[0.14em] text-gold mb-4">
                Vores eget format
              </span>
              <h3 className="font-display font-black text-cream text-[40px] lg:text-[64px] leading-[0.95]">
                Bodega Championship
              </h3>

              <p className="mt-6 font-display italic text-cream/95 text-[20px] lg:text-[22px] leading-snug max-w-[560px]">
                Du behøver ikke følge én liga — du følger Europa.
              </p>
              <p className="mt-3 font-body text-[15px] text-cream/75 leading-relaxed max-w-[520px]">
                Hver spillerunde samler vi automatisk rivalopgør, lokale derbys
                og storkampe fra 20 af Europas største ligaer.
              </p>

              {/* Stats — dramatic increase, vertical dividers between */}
              <div className="mt-10 py-8 grid grid-cols-3 max-w-lg divide-x divide-gold/30">
                {[
                  { value: '20', label: 'Ligaer' },
                  { value: '~130', label: 'Derbyer' },
                  { value: 'Auto', label: 'Spilrunder' },
                ].map((stat, i) => (
                  <div key={stat.label} className={i === 0 ? 'pr-4' : 'px-4'}>
                    <div className="font-display font-black text-gold text-[48px] lg:text-[72px] leading-none">
                      {stat.value}
                    </div>
                    <div className="mt-2 font-condensed font-semibold text-[10px] uppercase tracking-[0.14em] text-cream/55">
                      {stat.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right column — example round */}
            <div className="bg-forest-dark border border-gold/50 rounded-sm p-6">
              <div className="font-condensed font-bold text-[12px] uppercase tracking-[0.14em] text-gold mb-4">
                Runde 27 · Auto-genereret
              </div>
              <ul
                className="space-y-3 text-[12px] text-cream/85 leading-relaxed"
                style={{ fontFamily: "'Courier New', monospace" }}
              >
                {EXAMPLE_ROUND.map((match) => {
                  if (match.dim) {
                    return (
                      <li
                        key={match.name}
                        className="flex items-center gap-2 text-gold/60 pt-1"
                      >
                        <span>{match.name}</span>
                        <span aria-hidden>→</span>
                      </li>
                    )
                  }
                  return (
                    <li
                      key={match.name}
                      className="flex items-center justify-between gap-4"
                    >
                      <span>{match.name}</span>
                      {match.code && <span className="text-gold/80">{match.code}</span>}
                    </li>
                  )
                })}
              </ul>
            </div>
          </div>

          {/* CTA at bottom */}
          <div className="relative mt-12 flex flex-col items-center gap-3">
            <p className="font-body text-[13px] text-cream/60">
              Inviteret til en allerede?{' '}
              <Link href="/games" className="text-gold hover:text-cream transition-colors">
                Find den her
              </Link>
              .
            </p>
            <Link
              href="/games/new?sport=championship"
              className="inline-flex items-center justify-center px-8 py-4 bg-gold text-forest font-condensed font-bold text-[13px] uppercase tracking-widest rounded-sm hover:opacity-90 transition-opacity"
            >
              Start en championship-liga →
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
