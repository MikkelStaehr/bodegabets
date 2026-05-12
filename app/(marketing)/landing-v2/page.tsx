import type { Metadata } from 'next'
import Link from 'next/link'
import { getActiveUserCount, getLandingTickerItems } from '@/lib/landingData'
import HeroRotator from './HeroRotator'
import LandingTicker from '@/components/landing/LandingTicker'
import PriceSection from '@/components/landing/PriceSection'
import ChampionshipSection from '@/components/landing/ChampionshipSection'
import HowItWorksSection from '@/components/landing/HowItWorksSection'
import ProductsSection from '@/components/landing/ProductsSection'

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

// ProductsSection er nu shared — se components/landing/ProductsSection.tsx

// ─── 5. Bodega Championship ─────────────────────────────────────────────────

// ChampionshipSection er nu shared — se components/landing/ChampionshipSection.tsx

// HowItWorksSection er nu shared — se components/landing/HowItWorksSection.tsx

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
