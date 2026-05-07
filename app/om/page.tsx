import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Om Bodega Bets',
  description: 'Bodega Bets er en sport-fantasy platform hvor du spiller mod vennerne. Ingen rigtige penge, ingen reklamer fra spilfirmaer.',
}

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[#F2EDE4]">
      <div className="max-w-2xl mx-auto px-4 py-12 pb-24">
        <p className="font-condensed text-xs uppercase tracking-[0.14em] text-[#7a7060] mb-2">
          Om os
        </p>
        <h1 className="font-display text-4xl md:text-5xl font-bold text-[#1a3329] mb-8 leading-none">
          Sport, venner, point.
          <br />
          <span className="text-[#5C5C4A]">Ingen kasino.</span>
        </h1>

        <div className="space-y-6 font-body text-[15px] leading-relaxed text-[#1a1a1a]">
          <p>
            Bodega Bets er en fantasy-platform til fodbold og cykling.
            Du opretter spilrum med dine venner, sætter dine bets eller dit
            cycling-hold, og konkurrerer over sæsonen om hvem der er bedst.
          </p>

          <p>
            Vi bygger den fordi vi var trætte af at fantasy-sport altid skulle
            være indpakket i pengespil-reklamer eller kræve abonnementer på flere
            hundrede kroner om året. Bodega Bets bruger <strong>aldrig rigtige penge</strong>.
            Pointene er bare point — bragging rights mellem dig og vennerne.
          </p>

          <h2 className="font-display text-2xl font-bold text-[#1a3329] pt-4">
            Hvordan tjener I så penge?
          </h2>
          <p>
            Vi planlægger et lille abonnement (€1/måned) per bruger til at dække
            servere og udvikling. Ingen reklamer, ingen affiliate-deals med
            spilfirmaer. Hvis du er på en gratis test-version lige nu, er det
            fordi vi stadig er i alfa-fasen.
          </p>

          <h2 className="font-display text-2xl font-bold text-[#1a3329] pt-4">
            Hvem står bag?
          </h2>
          <p>
            En lille uafhængig udvikler i Danmark.
            Vil du fange os, så send en mail til{' '}
            <a
              href="mailto:hej@bodega-bets.com"
              className="font-semibold underline hover:no-underline"
              style={{ color: '#1a3329' }}
            >
              hej@bodega-bets.com
            </a>
            .
          </p>

          <h2 className="font-display text-2xl font-bold text-[#1a3329] pt-4">
            Hvor finder jeg…
          </h2>
          <ul className="space-y-2 list-none pl-0">
            <li>
              <Link href="/games/cycling-guide" className="font-semibold underline hover:no-underline" style={{ color: '#1a3329' }}>
                Cykling-regelsæt og pointsystem →
              </Link>
            </li>
            <li>
              <Link href="/faq" className="font-semibold underline hover:no-underline" style={{ color: '#1a3329' }}>
                FAQ →
              </Link>
            </li>
            <li>
              <Link href="/vilkaar" className="font-semibold underline hover:no-underline" style={{ color: '#1a3329' }}>
                Vilkår →
              </Link>
            </li>
            <li>
              <Link href="/privatlivspolitik" className="font-semibold underline hover:no-underline" style={{ color: '#1a3329' }}>
                Privatlivspolitik →
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </div>
  )
}
