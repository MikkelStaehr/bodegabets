import type { Metadata } from 'next'
import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabase'
import HeroRotator from './HeroRotator'

export const metadata: Metadata = {
  title: 'Bodega Bets — Spil mod vennerne',
  robots: { index: false, follow: false },
}

export const revalidate = 300 // 5 min cache for league count

// Skjult test-side til redesign-iteration. Ikke linket fra navigation.
// /landing-v2 (route group (marketing) ekskluderes fra URL).

async function getActiveLeagueCount(): Promise<number> {
  const { count } = await supabaseAdmin
    .from('seasons')
    .select('id', { count: 'exact', head: true })
    .eq('is_active', true)
  return count ?? 0
}

export default async function LandingV2() {
  const leagueCount = await getActiveLeagueCount()

  return (
    <div className="bg-forest text-cream min-h-screen">
      <TopBar />
      <HeroRotator leagueCount={leagueCount} />

      {/* Thick gold divider */}
      <div className="h-[3px] bg-gold" />

      <ProductsSection />
      <ChampionshipSection />
      <PriceSection />
    </div>
  )
}

// ─── Top bar ────────────────────────────────────────────────────────────────

function TopBar() {
  return (
    <div className="bg-forest border-b border-cream/10">
      <div className="max-w-6xl mx-auto px-6 lg:px-8 h-12 flex items-center justify-between">
        <span className="font-condensed text-[11px] uppercase tracking-[0.14em] text-cream/55">
          Bodega Bets · Sæson 25/26
        </span>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="font-condensed text-[12px] uppercase tracking-[0.08em] text-cream/70 hover:text-cream transition-colors"
          >
            Log ind
          </Link>
          <Link
            href="/register"
            className="bg-gold text-forest font-condensed font-bold text-[12px] uppercase tracking-[0.08em] px-4 py-2 rounded-sm hover:opacity-90 transition-opacity"
          >
            Kom i gang
          </Link>
        </div>
      </div>
    </div>
  )
}

// ─── Two products ───────────────────────────────────────────────────────────

const PRODUCT_CARDS = [
  {
    number: '01',
    tag: 'Fantasy',
    title: 'Cycling Manager',
    image: '/img/boxcycling.jpg',
    imagePosition: 'object-center',
    description:
      'Saml dit drømmehold af ryttere, fordel rolle og bonus, og følg dem gennem Grand Tours og monumenter.',
    features: [
      '8 roller per rytter',
      'Alle Grand Tours og monumenter',
      'Joker, hold-bonus, DNF-straffe',
      'Block-system per løb',
    ],
  },
  {
    number: '02',
    tag: 'Sports betting',
    title: 'Fodbold',
    image: '/img/emilio-garcia-AWdCgDDedH0-unsplash.jpg',
    imagePosition: 'object-center',
    description:
      'Forudsig kampe på tværs af 20 europæiske ligaer. Bet i åbent vindue, lås ved kickoff, scor live.',
    features: [
      'Per-kamp bet-lock 30 min før kickoff',
      'Konsensus-odds og rivalopgør',
      'Block-system med vinder-evaluering',
      'Realtids-leaderboard hele sæsonen',
    ],
  },
]

function ProductsSection() {
  return (
    <section id="products" className="bg-cream py-12 lg:py-24">
      <div className="max-w-6xl mx-auto px-6 lg:px-8">
        <div className="text-center mb-10 lg:mb-16">
          <span className="font-condensed text-[11px] uppercase tracking-[0.14em] text-gold-dark">
            De to spil
          </span>
          <h2 className="mt-3 font-display font-black text-forest text-[36px] lg:text-[56px] leading-none">
            Vælg din disciplin.
          </h2>
          <p className="mt-4 font-body text-[16px] text-warm-taupe max-w-[560px] mx-auto">
            Spil ét. Spil begge. Inkluderet i din månedlige adgang.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {PRODUCT_CARDS.map((card) => (
            <article
              key={card.number}
              className="group relative h-[520px] lg:h-[600px] border border-warm-border rounded-sm hover:border-gold transition-colors overflow-hidden bg-forest"
            >
              {/* Full-bleed photo with continuous Ken Burns + hover zoom */}
              <img
                src={card.image}
                alt={card.title}
                className={
                  'absolute inset-0 w-full h-full object-cover ' +
                  card.imagePosition +
                  ' animate-kenburns-slow transition-transform duration-[1500ms] ease-out group-hover:scale-110'
                }
                loading="lazy"
              />

              {/* Cinematic vignettes — top fade, heavy bottom anchor, side darken */}
              <div className="absolute inset-0 bg-gradient-to-t from-forest via-forest/70 via-40% to-transparent pointer-events-none" />
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background:
                    'radial-gradient(ellipse at 50% 30%, transparent 50%, rgba(26,51,41,0.45) 100%)',
                }}
              />

              {/* Gold accent line at top — appears on hover */}
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gold scale-x-0 group-hover:scale-x-100 origin-left transition-transform duration-700" />

              {/* Content overlay — bottom anchored */}
              <div className="absolute inset-x-0 bottom-0 p-6 lg:p-8">
                <span className="font-condensed font-semibold text-[11px] uppercase tracking-[0.14em] text-gold">
                  {card.tag}
                </span>

                <h3 className="mt-2 font-display font-black text-cream text-[36px] lg:text-[44px] leading-[0.95] drop-shadow-[0_2px_12px_rgba(0,0,0,0.6)]">
                  {card.title}
                </h3>

                <p className="mt-4 font-body text-[14px] lg:text-[15px] text-cream/85 leading-relaxed max-w-[440px] drop-shadow-[0_1px_4px_rgba(0,0,0,0.5)]">
                  {card.description}
                </p>

                <ul className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                  {card.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-center gap-2.5"
                    >
                      <span className="w-1 h-1 rounded-full bg-gold flex-shrink-0" />
                      <span className="font-condensed font-semibold text-[12px] uppercase tracking-[0.06em] text-cream/90 drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)]">
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Championship banner ────────────────────────────────────────────────────

const EXAMPLE_ROUND = [
  { name: 'El Clásico', code: 'RMA — BAR', dim: false },
  { name: 'Manchester Derby', code: 'MUN — MCI', dim: false },
  { name: 'Der Klassiker', code: 'BVB — BAY', dim: false },
  { name: 'Derby della Madonnina', code: 'INT — MIL', dim: false },
  { name: '+ 11 storkampe', code: '', dim: true },
] as const

function ChampionshipSection() {
  return (
    <section className="bg-forest pb-12 lg:pb-24">
      <div className="max-w-6xl mx-auto px-6 lg:px-8">
        <div className="relative bg-gradient-to-br from-gold/15 to-gold/5 border border-gold/40 rounded-sm p-6 lg:p-10 overflow-hidden">
          {/* Decorative rotated CHAMPIONSHIP */}
          <span
            aria-hidden
            className="absolute font-display font-black text-gold/[0.05] pointer-events-none select-none whitespace-nowrap"
            style={{
              fontSize: '96px',
              lineHeight: 1,
              right: '-40px',
              top: '50%',
              transform: 'translateY(-50%) rotate(-90deg)',
              transformOrigin: 'center',
            }}
          >
            CHAMPIONSHIP
          </span>

          <div className="relative grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-8 lg:gap-12">
            {/* Left: text + stats */}
            <div>
              <span className="font-condensed text-[11px] uppercase tracking-[0.14em] text-gold">
                Vores eget format
              </span>
              <h3 className="mt-2 font-display font-bold text-cream text-[28px] lg:text-[38px] leading-tight">
                Bodega Bet Championship
              </h3>
              <p className="mt-4 font-body text-[15px] text-cream/80 leading-relaxed max-w-[520px]">
                Hver spillerunde samler vi automatisk rivalopgør, lokale derbys
                og storkampe fra 20 af Europas største ligaer. Du behøver ikke
                følge én liga — du følger Europa.
              </p>

              {/* Stats */}
              <div className="mt-8 grid grid-cols-3 gap-4 max-w-md">
                {[
                  { value: '20', label: 'Ligaer' },
                  { value: '~130', label: 'Derbyer' },
                  { value: 'Auto', label: 'Spilrunder' },
                ].map((stat) => (
                  <div key={stat.label}>
                    <div className="font-display font-bold text-gold text-[32px] lg:text-[36px] leading-none">
                      {stat.value}
                    </div>
                    <div className="mt-1 font-condensed text-[10px] uppercase tracking-[0.14em] text-cream/55">
                      {stat.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: example round preview */}
            <div className="bg-forest/80 border border-gold/30 rounded-sm p-5">
              <div className="font-condensed text-[10px] uppercase tracking-[0.14em] text-gold/90 mb-4">
                Runde 27 · Auto-genereret
              </div>
              <ul
                className="space-y-2.5 text-[12px] text-cream/85"
                style={{ fontFamily: "'Courier New', monospace" }}
              >
                {EXAMPLE_ROUND.map((match) => (
                  <li
                    key={match.name}
                    className={
                      'flex items-center justify-between gap-4 ' +
                      (match.dim ? 'opacity-50' : '')
                    }
                  >
                    <span>{match.name}</span>
                    {match.code && <span className="text-gold/80">{match.code}</span>}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── Price callout ──────────────────────────────────────────────────────────

function PriceSection() {
  return (
    <section className="bg-cream py-12 lg:py-24">
      <div className="max-w-6xl mx-auto px-6 lg:px-8">
        <div className="bg-cream-dark border border-warm-border rounded-sm p-8 lg:p-14 text-center">
          <span className="font-condensed text-[11px] uppercase tracking-[0.14em] text-gold-dark">
            Én pris. Alt indeholdt.
          </span>

          <div className="mt-4 flex items-baseline justify-center gap-2">
            <span
              className="font-display font-black text-forest leading-none"
              style={{ fontSize: '96px' }}
            >
              1€
            </span>
            <span className="font-condensed text-[16px] text-warm-taupe">
              /måned
            </span>
          </div>

          <p className="mt-6 font-body text-[16px] text-warm-gray max-w-[520px] mx-auto leading-relaxed">
            Begge spil. Ubegrænsede ligaer. Hele sæsonen. Ingen indskud,
            ingen gevinster, ingen reklamer.
          </p>
        </div>
      </div>
    </section>
  )
}
