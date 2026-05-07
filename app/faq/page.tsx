import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'FAQ',
  description: 'Ofte stillede spørgsmål om Bodega Bets.',
}

const FAQ: { q: string; a: React.ReactNode }[] = [
  {
    q: 'Bruger I rigtige penge?',
    a: (
      <p>
        Nej. Bodega Bets bruger aldrig rigtige penge. Pointene er virtuelle og kan
        ikke veksles til kontanter, gavekort eller andre værdier. Platformen er
        ikke et pengespilssite og er ikke underlagt spillelovgivning.
      </p>
    ),
  },
  {
    q: 'Hvordan opretter jeg et spilrum?',
    a: (
      <p>
        Gå til dashboardet og tryk &quot;Opret spilrum&quot;. Du vælger sport
        (fodbold eller cykling), giver det et navn, og inviterer vennerne via
        en delt invite-kode. Til cykling vælger du desuden hvilke løb der skal
        være med.
      </p>
    ),
  },
  {
    q: 'Kan jeg deltage i flere spilrum?',
    a: (
      <p>
        Ja, så mange du har lyst til. Hvert spilrum har sin egen leaderboard og
        konkurrence — uafhængigt af de andre.
      </p>
    ),
  },
  {
    q: 'Hvor ofte opdateres point?',
    a: (
      <p>
        Fodbold: indenfor ~1 minut efter en kamp slutter. Cykling: indenfor
        ~30 minutter efter en etape er færdig (vi henter resultater fra ProCyclingStats).
        Live-scores under en kamp opdateres hvert 30. sekund i din browser.
      </p>
    ),
  },
  {
    q: 'Hvad sker der når en cykel-blok er færdig?',
    a: (
      <p>
        Block-sejren tildeles, point nulstilles til den næste blok, og du skal
        vælge en ny brutto-trup. Sæsonen fortsætter indtil sidste blok eller
        til værten arkiverer rummet.
      </p>
    ),
  },
  {
    q: 'Kan jeg få mine point tilbage hvis der er en fejl?',
    a: (
      <p>
        Hvis vi opdager en sync-fejl (f.eks. forkerte resultater fra
        datakilden), genberegner vi point automatisk. Hvis du oplever noget der
        ikke ser rigtigt ud, så send os en mail med game-id og hvad du forventer.
      </p>
    ),
  },
  {
    q: 'Hvordan sletter jeg min konto?',
    a: (
      <p>
        Gå til{' '}
        <Link
          href="/profile"
          className="font-semibold underline hover:no-underline"
          style={{ color: '#1a3329' }}
        >
          din profil-side
        </Link>{' '}
        og scroll ned til &quot;Farezone&quot;. Sletning er permanent og fjerner
        alle dine bets, lineups og spilrum-medlemskaber.
      </p>
    ),
  },
  {
    q: 'Hvor finder jeg cykling-reglerne?',
    a: (
      <p>
        Det fulde regelsæt med pointsystem, roller og bonusser ligger på{' '}
        <Link
          href="/games/cycling-guide"
          className="font-semibold underline hover:no-underline"
          style={{ color: '#1a3329' }}
        >
          /games/cycling-guide
        </Link>
        . En kompakt rolle-tabel ligger også i bunden af hvert cykel-spilrum.
      </p>
    ),
  },
  {
    q: 'Spammer I min mail?',
    a: (
      <p>
        Nej. Vi sender kun mails der er nødvendige for kontoen (login-bekræftelse,
        password-reset) og evt. valgfrie deadline-påmindelser. Du kan altid slå
        notifikationer fra i din profil.
      </p>
    ),
  },
  {
    q: 'Hvor kan jeg rapportere en bug eller komme med ønsker?',
    a: (
      <p>
        Send en mail til{' '}
        <a
          href="mailto:hej@bodega-bets.com"
          className="font-semibold underline hover:no-underline"
          style={{ color: '#1a3329' }}
        >
          hej@bodega-bets.com
        </a>
        . Vi læser alt og svarer typisk inden for et par dage.
      </p>
    ),
  },
]

export default function FAQPage() {
  return (
    <div className="min-h-screen bg-[#F2EDE4]">
      <div className="max-w-2xl mx-auto px-4 py-12 pb-24">
        <p className="font-condensed text-xs uppercase tracking-[0.14em] text-[#7a7060] mb-2">
          Hjælp
        </p>
        <h1 className="font-display text-4xl md:text-5xl font-bold text-[#1a3329] mb-10 leading-none">
          Ofte stillede spørgsmål
        </h1>

        <div className="space-y-8">
          {FAQ.map((item, i) => (
            <div key={i} className="pb-6 border-b" style={{ borderColor: '#E5DFD2' }}>
              <h2 className="font-display text-xl font-bold mb-3" style={{ color: '#1a3329' }}>
                {item.q}
              </h2>
              <div className="font-body text-[15px] leading-relaxed text-[#1a1a1a]">
                {item.a}
              </div>
            </div>
          ))}
        </div>

        <p className="font-body text-sm text-[#7a7060] mt-12">
          Mangler du svar? Skriv til{' '}
          <a
            href="mailto:hej@bodega-bets.com"
            className="font-semibold underline hover:no-underline"
            style={{ color: '#1a3329' }}
          >
            hej@bodega-bets.com
          </a>
          .
        </p>
      </div>
    </div>
  )
}
