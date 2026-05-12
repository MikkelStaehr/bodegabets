import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { getActiveUserCount, getLandingTickerItems } from '@/lib/landingData'
import HeroRotator from './HeroRotator'
import LandingTicker from '@/components/landing/LandingTicker'
import PriceSection from '@/components/landing/PriceSection'

export const metadata: Metadata = {
  title: 'Bodega Bets — Spil mod vennerne',
  description:
    'Spil mod vennerne i sport-fantasy spilrum. Fodbold-tipping, cykel-fantasy og mesterskaber. Ingen rigtige penge.',
  robots: { index: false, follow: false },
}

export const revalidate = 300 // 5 min cache

// Skjult test-side til redesign-iteration. Ikke linket fra navigation.
// /landing-v2 (route group (marketing) ekskluderes fra URL).

// Ticker-data hentes nu fra shared lib/landingData så samme logik bruges på /
// og /landing-v2.

export default async function LandingV2() {
  const [activeUserCount, ticker] = await Promise.all([
    getActiveUserCount(),
    getLandingTickerItems(),
  ])

  return (
    <div className="bg-forest text-cream min-h-screen">
      <TopBar />
      <HeroRotator activeUserCount={activeUserCount} />

      {/* Thick gold divider */}
      <div className="h-[3px] bg-gold" />

      {/* Live nyhedsbjælke — næste runders fodbold-kampe + cykel-etaper */}
      {ticker.items.length > 0 && (
        <LandingTicker items={ticker.items} currentDate={ticker.currentDate} />
      )}

      <PriceSection />
      <ProductsSection />
      <ChampionshipSection />
      <HowItWorksSection />
      <SocialProofSection />
      <FaqSection />
      <FinalCtaSection />
      <SiteFooter />
    </div>
  )
}

// ─── 1. Top bar ─────────────────────────────────────────────────────────────

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

// ─── 3. Price receipt ───────────────────────────────────────────────────────

// PriceSection er nu shared — se components/landing/PriceSection.tsx

// ─── 4. Two products ────────────────────────────────────────────────────────

const PRODUCT_CARDS = [
  {
    tag: 'Fantasy',
    title: 'Cycling Manager',
    image: '/landing/cycling-manager-app.jpg',
    description:
      'Saml dit drømmehold af ryttere, fordel roller og bonusser, og følg dem gennem Grand Tours og monumenter. Otte roller per rytter, joker når det gælder, point efter hver etape.',
    features: [
      '8 roller per rytter',
      'Alle Grand Tours og monumenter',
      'Joker, hold-bonus, DNF-straffe',
      'Block-system per løb',
    ],
  },
  {
    tag: 'Tipping',
    title: 'Fodbold',
    image: '/landing/fodbold-app.jpg',
    description:
      'Tip vinderne på tværs af 20 europæiske ligaer. Bet-vinduet låser 30 minutter før kickoff, og point opdateres i realtid mens du følger med.',
    features: [
      'Per-kamp lock 30 min før kickoff',
      'Konsensus-odds og rivalopgør',
      'Block-system med vinder-evaluering',
      'Realtids-leaderboard hele sæsonen',
    ],
  },
] as const

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
              key={card.title}
              className="group relative h-[520px] lg:h-[600px] border border-warm-border rounded-sm hover:border-gold transition-colors overflow-hidden bg-forest"
            >
              <Image
                src={card.image}
                alt={card.title}
                fill
                sizes="(min-width: 1024px) 50vw, 100vw"
                quality={75}
                className="object-cover object-center animate-kenburns-slow transition-transform duration-[1500ms] ease-out group-hover:scale-110"
              />

              {/* Heavier vignette per spec — forest/0.85 top, forest/0.95 bottom */}
              <div className="absolute inset-0 bg-gradient-to-b from-forest/85 via-forest/60 to-forest/95 pointer-events-none" />
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background:
                    'radial-gradient(ellipse at 50% 30%, transparent 50%, rgba(26,51,41,0.45) 100%)',
                }}
              />

              {/* Gold accent line at top — appears on hover */}
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gold scale-x-0 group-hover:scale-x-100 origin-left transition-transform duration-700" />

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
                    <li key={feature} className="flex items-center gap-2.5">
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

// ─── 5. Bodega Championship ─────────────────────────────────────────────────

const EXAMPLE_ROUND = [
  { name: 'El Clásico', code: 'RMA — BAR', dim: false },
  { name: 'Manchester Derby', code: 'MUN — MCI', dim: false },
  { name: 'Der Klassiker', code: 'BVB — BAY', dim: false },
  { name: 'Derby della Madonnina', code: 'INT — MIL', dim: false },
  { name: '+ 11 storkampe', code: '', dim: true },
] as const

function ChampionshipSection() {
  return (
    <section className="bg-forest py-16 lg:py-28">
      <div className="max-w-6xl mx-auto px-6 lg:px-8">
        <div className="relative bg-gradient-to-br from-gold/15 to-gold/5 border border-gold/40 rounded-sm p-6 lg:p-12 overflow-hidden">
          {/* Static BODEGA wordmark bottom-right (replaces rotated CHAMPIONSHIP) */}
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

            {/* Right column — example round, stronger contrast */}
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

// ─── 6. How it works ────────────────────────────────────────────────────────

const HOW_STEPS = [
  { num: '01', label: 'Opret eller join en liga' },
  { num: '02', label: 'Tip før kickoff' },
  { num: '03', label: 'Se hvem der fører' },
] as const

function HowItWorksSection() {
  return (
    <section id="how-it-works" className="bg-cream py-16 lg:py-28">
      <div className="max-w-5xl mx-auto px-6 lg:px-8">
        <div className="text-center mb-12 lg:mb-16">
          <span className="font-condensed font-semibold text-[11px] uppercase tracking-[0.14em] text-gold-dark">
            Sådan virker det
          </span>
        </div>

        {/* Desktop horizontal timeline */}
        <div className="hidden lg:flex items-center">
          {HOW_STEPS.map((step, i) => (
            <div key={step.num} className="contents">
              <div className="flex-1 bg-cream/50 border border-forest/10 rounded-sm p-6 text-center">
                <div className="font-display font-black text-gold leading-none text-[48px]">
                  {step.num}
                </div>
                <div className="mt-2 font-condensed font-bold text-forest-dark text-[12px] uppercase tracking-widest">
                  {step.label}
                </div>
              </div>
              {i < HOW_STEPS.length - 1 && (
                <div
                  aria-hidden
                  className="flex-1 h-0 mx-3 border-t border-dotted border-gold/40"
                />
              )}
            </div>
          ))}
        </div>

        {/* Mobile vertical timeline */}
        <div className="lg:hidden flex flex-col">
          {HOW_STEPS.map((step, i) => (
            <div key={step.num} className="contents">
              <div className="bg-cream/50 border border-forest/10 rounded-sm p-6 text-center">
                <div className="font-display font-black text-gold leading-none text-[48px]">
                  {step.num}
                </div>
                <div className="mt-2 font-condensed font-bold text-forest-dark text-[12px] uppercase tracking-widest">
                  {step.label}
                </div>
              </div>
              {i < HOW_STEPS.length - 1 && (
                <div
                  aria-hidden
                  className="w-0 h-8 mx-auto border-l border-dotted border-gold/40"
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── 7. Social proof ────────────────────────────────────────────────────────

function SocialProofSection() {
  return (
    <section className="bg-cream pb-16 lg:pb-28">
      <div className="max-w-[600px] mx-auto px-6 lg:px-8">
        {/* Hairline gold divider connects visually with How it works */}
        <div aria-hidden className="h-px bg-gold/30 mb-12 lg:mb-16" />

        <div className="text-center mb-5">
          <span className="font-condensed font-semibold text-[11px] uppercase tracking-[0.14em] text-gold-dark">
            Hvor vi er
          </span>
        </div>

        <blockquote className="relative font-display text-forest text-[18px] lg:text-[22px] leading-snug">
          {/* Hanging open-quote glyph in gold, overflows left margin */}
          <span
            aria-hidden
            className="absolute font-display text-gold/70 select-none pointer-events-none leading-none"
            style={{
              left: '-0.4em',
              top: '-0.25em',
              fontSize: '3em',
            }}
          >
            “
          </span>
          <span className="relative">
            Vi er lige startet. Fire vennegrupper bruger det allerede. Når VM
            kicker af i sommer er treholdsskiftet på fabrikken med.”
          </span>
        </blockquote>

        <div
          className="mt-3 text-[13px] text-gold-dark/80"
          style={{ fontFamily: "'Courier New', monospace" }}
        >
          — Mikkel &amp; Louise, grundlæggere
        </div>
      </div>
    </section>
  )
}

// ─── 8. FAQ ─────────────────────────────────────────────────────────────────

const FAQ_ITEMS = [
  {
    q: 'Er det gambling?',
    a: 'Nej. Du betaler ikke for at deltage i et spil — du betaler for adgang til platformen. Der er ingen indskud, ingen gevinster, ingen rigtige penge. Det er et socialt samlingspunkt, ikke et casino.',
  },
  {
    q: 'Hvad får jeg for 1€ om måneden?',
    a: 'Adgang til alt: Cycling Manager, Fodbold-tipping, Bodega Championship og ubegrænsede ligaer med dine venner. Ingen tillægskøb.',
  },
  {
    q: 'Kan jeg prøve det gratis først?',
    a: 'Nej, og det er et bevidst valg. 1€ om måneden er allerede så lavt at en prøveperiode ville skabe friktion uden reel værdi. Hver krone går direkte til de licenser og data der driver platformen — uden dem, intet spil. Du forpligter dig ikke til mere end én måned ad gangen.',
  },
  {
    q: 'Hvor mange kan være med i en liga?',
    a: 'Op til 100 medlemmer per spil. Det er rigeligt til vennegruppen, kontoret, klubben eller hele treholdsskiftet på fabrikken.',
  },
  {
    q: 'Kan jeg spille begge spil samtidig?',
    a: 'Ja. Du kan have ligaer i Cycling Manager, Fodbold-tipping og Bodega Championship parallelt. Samme konto, samme abonnement.',
  },
  {
    q: 'Hvad sker der hvis jeg sletter mit abonnement?',
    a: 'Du beholder adgang til indeværende periode. Dine ligaer pauses men slettes ikke — du kan komme tilbage hvor som helst.',
  },
] as const

function FaqSection() {
  return (
    <section className="bg-forest py-16 lg:py-28">
      <div className="max-w-3xl mx-auto px-6 lg:px-8">
        <div className="mb-10 lg:mb-14">
          <span className="font-condensed font-semibold text-[11px] uppercase tracking-[0.14em] text-gold">
            Ofte stillede spørgsmål
          </span>
          <h2 className="mt-3 font-display font-black text-cream text-[36px] lg:text-[48px] leading-tight">
            Det meste du gerne vil vide.
          </h2>
        </div>

        <div className="border-t border-cream/15">
          {FAQ_ITEMS.map((item) => (
            <details
              key={item.q}
              className="group border-b border-cream/15 [&>summary]:list-none"
            >
              <summary className="flex items-center justify-between gap-6 py-5 cursor-pointer select-none">
                <span className="font-display font-bold text-cream text-[18px] lg:text-[20px]">
                  {item.q}
                </span>
                <svg
                  className="w-4 h-4 text-gold flex-shrink-0 transition-transform duration-300 group-open:rotate-180"
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 8l5 5 5-5" />
                </svg>
              </summary>
              <p className="pb-6 pr-10 font-body text-[14px] text-cream/75 leading-relaxed">
                {item.a}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── 9. Final CTA ───────────────────────────────────────────────────────────

function FinalCtaSection() {
  return (
    <section className="bg-cream py-20 lg:py-32">
      <div className="max-w-3xl mx-auto px-6 lg:px-8 text-center">
        <h2 className="font-display font-black text-forest text-[40px] lg:text-[56px] leading-[0.95]">
          Klar til at starte en liga?
        </h2>
        <p className="mt-5 font-body text-[16px] text-warm-gray max-w-[460px] mx-auto leading-relaxed">
          Inviter vennerne, vælg sport, og lad sæsonen begynde.
        </p>
        <Link
          href="/register"
          className="mt-10 inline-flex items-center justify-center px-10 py-5 bg-gold text-forest font-condensed font-bold text-[14px] uppercase tracking-widest rounded-sm hover:opacity-90 transition-opacity"
        >
          Kom i gang →
        </Link>
      </div>
    </section>
  )
}

// ─── 10. Footer ─────────────────────────────────────────────────────────────

function SiteFooter() {
  return (
    <footer className="bg-forest border-t border-gold/20">
      <div className="max-w-6xl mx-auto px-6 lg:px-8 py-12 lg:py-16">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 lg:divide-x lg:divide-cream/10">
          {/* Brand */}
          <div className="lg:pr-8">
            <span className="logo-font text-cream text-[28px]">bodega bets</span>
            <p className="mt-3 font-body text-[14px] text-cream/65 leading-relaxed max-w-[280px]">
              Spil med vennerne. Ingen rigtige penge.
            </p>
          </div>

          {/* Product */}
          <div className="lg:px-8">
            <div className="font-condensed font-semibold text-[10px] uppercase tracking-[0.14em] text-cream/45">
              Bodega Bets
            </div>
            <ul className="mt-4 space-y-2 font-body text-[14px]">
              <li>
                <Link href="/about" className="text-cream/80 hover:text-gold transition-colors">
                  Om
                </Link>
              </li>
              <li>
                <Link href="#faq" className="text-cream/80 hover:text-gold transition-colors">
                  FAQ
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-cream/80 hover:text-gold transition-colors">
                  Kontakt
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div className="lg:pl-8">
            <div className="font-condensed font-semibold text-[10px] uppercase tracking-[0.14em] text-cream/45">
              Legalt
            </div>
            <ul className="mt-4 space-y-2 font-body text-[14px]">
              <li>
                <Link
                  href="/privacy"
                  className="text-cream/80 hover:text-gold transition-colors"
                >
                  Privatlivspolitik
                </Link>
              </li>
              <li>
                <Link
                  href="/cookies"
                  className="text-cream/80 hover:text-gold transition-colors"
                >
                  Cookie-politik
                </Link>
              </li>
              <li>
                <Link href="/terms" className="text-cream/80 hover:text-gold transition-colors">
                  Vilkår
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-gold/20 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="font-condensed text-[11px] uppercase tracking-[0.14em] text-cream/45">
            © 2026 Bodega Bets · A Stæhrs. product
          </p>
        </div>
      </div>
    </footer>
  )
}
