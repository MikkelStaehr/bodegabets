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

// ─── Price callout ──────────────────────────────────────────────────────────

const RECEIPT_LINES = [
  { label: 'Cykling live-data', value: 'inkluderet' },
  { label: 'Fodbold live-data · 20 ligaer', value: 'inkluderet' },
  { label: 'Bodega Championship', value: 'inkluderet' },
  { label: 'Drift & vedligehold', value: 'inkluderet' },
] as const

function PriceSection() {
  return (
    <section className="bg-cream py-16 lg:py-32">
      <div className="max-w-5xl mx-auto px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_1fr] gap-12 lg:gap-20 items-center">
          {/* Left: editorial statement */}
          <div>
            <span className="font-condensed font-semibold text-[11px] uppercase tracking-[0.14em] text-gold-dark">
              Én pris · ingen profit
            </span>

            <h2 className="mt-4 font-display font-black text-forest text-[40px] lg:text-[56px] leading-[0.95]">
              Du betaler til{' '}
              <span className="italic text-gold-dark">oplevelsen</span>
              <span className="text-forest">.</span>
              <br />
              Ikke til udvikleren.
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
            className="relative bg-cream-dark border border-warm-border rounded-sm p-7 lg:p-8 shadow-[0_1px_0_rgba(0,0,0,0.04)]"
            style={{ fontFamily: "'Courier New', monospace" }}
          >
            {/* Receipt header */}
            <div className="text-center">
              <div className="font-condensed font-semibold text-[10px] uppercase tracking-[0.2em] text-warm-taupe">
                Bodega Bets · Sæson 25/26
              </div>
              <div className="mt-1 font-condensed text-[10px] uppercase tracking-[0.14em] text-warm-taupe/70">
                medlemskab · månedlig
              </div>
            </div>

            {/* Dotted divider */}
            <div className="my-5 border-t border-dashed border-warm-border" />

            {/* Line items */}
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

            {/* Dotted divider */}
            <div className="my-5 border-t border-dashed border-warm-border" />

            {/* Total */}
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

            {/* Dotted divider */}
            <div className="my-5 border-t border-dashed border-warm-border" />

            {/* Footer note */}
            <p className="text-center text-[10px] uppercase tracking-[0.14em] text-warm-taupe/80">
              tak fordi du spiller med
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
