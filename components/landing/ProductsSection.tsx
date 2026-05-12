import Image from 'next/image'

/**
 * Magazine-cover product-cards der præsenterer de to formater (Fantasy +
 * Tipping). Genbrugt mellem / og /landing-v2.
 *
 * comingSoon-badge ved hver title forbereder narrativet til F1 + tennis-
 * launch — vi opdaterer bare strengen når de er klar.
 */

const PRODUCT_CARDS = [
  {
    discipline: 'Cykling',
    gamemode: 'Fantasy',
    comingSoon: 'F1 snart',
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
    discipline: 'Fodbold',
    gamemode: 'Konsensus-betting',
    comingSoon: 'Tennis snart',
    image: '/landing/fodbold-app.jpg',
    description:
      'Tip vinderne på tværs af 20 europæiske ligaer. Bet-vinduet låser 30 minutter før kickoff, og jo sjældnere dit valg er, jo større bliver din multiplier — op til ×1.8.',
    features: [
      'Per-kamp lock 30 min før kickoff',
      'Konsensus-odds op til ×1.8',
      'Rivalopgør og storkampe-bonus',
      'Realtids-leaderboard hele sæsonen',
    ],
  },
] as const

export default function ProductsSection() {
  return (
    <section id="products" className="bg-cream py-12 lg:py-24">
      <div className="max-w-6xl mx-auto px-6 lg:px-8">
        <div className="text-center mb-10 lg:mb-16">
          <span className="font-condensed text-[11px] uppercase tracking-[0.14em] text-gold-dark">
            To gamemodes
          </span>
          <h2 className="mt-3 font-display font-black text-forest text-[36px] lg:text-[56px] leading-none">
            Vælg dit format.
          </h2>
          <p className="mt-4 font-body text-[16px] text-warm-taupe max-w-[560px] mx-auto">
            Spil ét. Spil begge. Begge inkluderet i din månedlige adgang.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {PRODUCT_CARDS.map((card) => (
            <article
              key={card.gamemode}
              className="group relative h-[520px] lg:h-[600px] border border-warm-border rounded-sm hover:border-gold transition-colors overflow-hidden bg-forest"
            >
              <Image
                src={card.image}
                alt={card.gamemode}
                fill
                sizes="(min-width: 1024px) 50vw, 100vw"
                quality={75}
                className="object-cover object-center animate-kenburns-slow transition-transform duration-[1500ms] ease-out group-hover:scale-110"
              />

              {/* Heavier vignette */}
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
                  {card.discipline}
                </span>

                <div className="mt-2 flex items-start gap-3 flex-wrap">
                  <h3 className="font-display font-black text-cream text-[36px] lg:text-[44px] leading-[0.95] drop-shadow-[0_2px_12px_rgba(0,0,0,0.6)]">
                    {card.gamemode}
                  </h3>
                  {card.comingSoon && (
                    <span className="mt-2 font-condensed font-semibold text-[10px] uppercase tracking-[0.14em] text-gold border border-gold/40 rounded-sm px-2 py-1 self-start">
                      + {card.comingSoon}
                    </span>
                  )}
                </div>

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
