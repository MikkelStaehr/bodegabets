import Link from 'next/link'

export default function PrivatlivspolitikPage() {
  return (
    <div className="min-h-screen bg-cream">
      <div className="max-w-[640px] mx-auto px-6 py-16">
        <Link href="/" className="font-body text-warm-gray text-sm hover:text-ink transition-colors mb-8 block">
          ← Tilbage
        </Link>
        <h1 className="font-display italic text-ink mb-8" style={{ fontWeight: 700, fontSize: 40 }}>
          Privatlivspolitik
        </h1>
        <div className="font-body text-warm-gray text-sm leading-relaxed space-y-6">
          <p>Bodega Bets er en privat, ikke-kommerciel platform til underholdning mellem venner. Vi indsamler og behandler kun de personoplysninger der er nødvendige for at drive tjenesten.</p>
          <h2 className="font-condensed text-ink text-sm uppercase tracking-widest" style={{ fontWeight: 700 }}>Hvilke data indsamler vi?</h2>
          <p>Vi indsamler din e-mailadresse og det brugernavn du vælger ved registrering. Vi gemmer dine bets og pointhistorik som en del af spillet.</p>
          <h2 className="font-condensed text-ink text-sm uppercase tracking-widest" style={{ fontWeight: 700 }}>Hvordan bruges dine data?</h2>
          <p>Dine data bruges udelukkende til at drive Bodega Bets — herunder login, leaderboard og bet-historik. Vi sælger aldrig dine data til tredjepart.</p>
          <h2 className="font-condensed text-ink text-sm uppercase tracking-widest" style={{ fontWeight: 700 }}>Sletning af data</h2>
          <p>Du kan til enhver tid anmode om sletning af din profil og alle tilknyttede data ved at kontakte os.</p>
          <h2 className="font-condensed text-ink text-sm uppercase tracking-widest" style={{ fontWeight: 700 }}>Kontakt</h2>
          <p>Har du spørgsmål til vores behandling af personoplysninger, er du velkommen til at kontakte os.</p>
        </div>
      </div>
    </div>
  )
}
