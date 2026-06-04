/**
 * Sådan virker det — opdeler de to formater (Fantasy + Tipping) side om side
 * så brugeren får hver disciplinerings reelle flow at se.
 *
 * Fantasy: pick-the-heros (Cykling nu, F1 snart)
 * Tipping: bet udfald (Fodbold nu, Tennis snart)
 *
 * Cream-baggrund så vi bevarer rytmen cream → forest → cream → ... på landing.
 */

const FANTASY_STEPS = [
  { num: '01', title: 'Vælg din trup', desc: 'Samle ryttere før løbet starter. Roller, bonusser, joker.' },
  { num: '02', title: 'Følg etapen live', desc: 'Trøje-bonus, spurt-tog og hold-bonusser afgøres undervejs.' },
  { num: '03', title: 'Score per etape', desc: 'Point opdateres efter hver etape — leaderboard kører i realtid.' },
] as const

const TIPPING_STEPS = [
  { num: '01', title: 'Tip udfald', desc: '1-X-2 + ekstra bets (clean sheet, vindermarginal, scorer 3+).' },
  { num: '02', title: 'Vindue låser før kickoff', desc: 'Bet-vinduet lukker 30 min før kampstart — ingen efter-snak.' },
  { num: '03', title: 'Score når kampen er slut', desc: 'Point afregnes automatisk på leaderboard så snart kampen er færdig.' },
] as const

type Step = (typeof FANTASY_STEPS)[number] | (typeof TIPPING_STEPS)[number]

function StepRow({ step }: { step: Step }) {
  return (
    <div className="flex items-baseline gap-4 sm:gap-5">
      <span className="font-display italic font-[900] text-gold/30 leading-none text-[44px] sm:text-[56px] shrink-0 w-[60px] sm:w-[72px] text-right">
        {step.num}
      </span>
      <div className="min-w-0 pt-2">
        <h4 className="font-condensed font-bold text-ink text-sm sm:text-base uppercase tracking-[0.06em] mb-1">
          {step.title}
        </h4>
        <p className="font-body text-warm-gray text-[13px] sm:text-sm leading-relaxed">
          {step.desc}
        </p>
      </div>
    </div>
  )
}

function FormatColumn({
  category,
  tagline,
  steps,
  signatureLabel,
  signatureTitle,
  signatureDesc,
  disciplines,
}: {
  category: string
  tagline: string
  steps: readonly Step[]
  signatureLabel: string
  signatureTitle: string
  signatureDesc: string
  disciplines: string
}) {
  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="mb-8 sm:mb-10">
        <span className="font-condensed font-semibold text-[11px] uppercase tracking-[0.14em] text-gold-dark">
          {category}
        </span>
        <p className="mt-2 font-display italic text-forest text-[22px] sm:text-[28px] leading-tight">
          {tagline}
        </p>
      </div>

      {/* Steps */}
      <div className="space-y-6 sm:space-y-8 flex-1">
        {steps.map((step) => (
          <StepRow key={step.num} step={step} />
        ))}
      </div>

      {/* Signature mechanic */}
      <div className="mt-10 pt-6 border-t border-gold/30">
        <p className="font-condensed font-semibold text-[10px] uppercase tracking-[0.14em] text-gold-dark mb-2">
          ✦ {signatureLabel}
        </p>
        <p className="font-display italic text-forest text-[17px] sm:text-[19px] leading-snug mb-1">
          {signatureTitle}
        </p>
        <p className="font-body text-warm-gray text-[13px] leading-relaxed">
          {signatureDesc}
        </p>
      </div>

      {/* Disciplines badge */}
      <div className="mt-6 pt-4 border-t border-warm-border">
        <p className="font-condensed text-[11px] uppercase tracking-[0.14em] text-warm-taupe">
          {disciplines}
        </p>
      </div>
    </div>
  )
}

export default function HowItWorksSection() {
  return (
    <section className="bg-cream py-16 lg:py-24">
      <div className="max-w-6xl mx-auto px-6 lg:px-8">
        {/* Section header */}
        <div className="mb-12 lg:mb-16">
          <div className="flex items-center gap-3 mb-3">
            <span className="block w-6 h-[2px] bg-gold" />
            <span className="font-condensed font-semibold text-xs uppercase tracking-[0.14em] text-gold-dark">
              Sådan virker det
            </span>
          </div>
          <h2 className="font-display text-forest text-[clamp(32px,5vw,52px)] leading-[1.05]">
            <span className="font-display italic font-bold">To formater.</span>{' '}
            <span className="text-warm-gray font-bold">Samme spil.</span>
          </h2>
        </div>

        {/* Two columns */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-16 lg:gap-20">
          <FormatColumn
            category="Fantasy"
            tagline="Pick-the-heros."
            steps={FANTASY_STEPS}
            signatureLabel="Signatur"
            signatureTitle="Role-bonus + joker."
            signatureDesc="Hver rytter har en rolle (Klatrer, Sprinter, GC...). Tør du gætte hvem der angriber? Joker × 1.5 på den rytter du tror på den dag."
            disciplines="Cykling · F1 snart"
          />
          <FormatColumn
            category="Tipping"
            tagline="Bet udfald."
            steps={TIPPING_STEPS}
            signatureLabel="Signatur"
            signatureTitle="Konsensus-odds — op til ×1.8."
            signatureDesc="Jo sjældnere dit valg, jo større multiplier. Du belønnes for at gå mod strømmen — ikke for at følge favoritten."
            disciplines="Fodbold · Tennis snart"
          />
        </div>
      </div>
    </section>
  )
}
