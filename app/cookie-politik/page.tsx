import Link from 'next/link'

export default function CookiePolitikPage() {
  return (
    <div className="min-h-screen bg-cream">
      <div className="max-w-[640px] mx-auto px-6 py-16">
        <Link href="/" className="font-body text-warm-gray text-sm hover:text-ink transition-colors mb-8 block">
          ← Tilbage
        </Link>
        <h1 className="font-display italic text-ink mb-8" style={{ fontWeight: 700, fontSize: 40 }}>
          Cookie politik
        </h1>
        <div className="font-body text-warm-gray text-sm leading-relaxed space-y-6">
          <p>Bodega Bets bruger cookies til at holde dig logget ind og huske dine præferencer. Vi bruger ikke cookies til markedsføring eller sporing.</p>
          <h2 className="font-condensed text-ink text-sm uppercase tracking-widest" style={{ fontWeight: 700 }}>Nødvendige cookies</h2>
          <p>Vi bruger session-cookies til at håndtere login via Supabase Auth. Disse cookies er nødvendige for at tjenesten fungerer og kan ikke fravælges.</p>
          <h2 className="font-condensed text-ink text-sm uppercase tracking-widest" style={{ fontWeight: 700 }}>Tredjeparts cookies</h2>
          <p>Vi bruger ingen tredjeparts tracking- eller markedsføringscookies. Vi viser ingen reklamer.</p>
        </div>
      </div>
    </div>
  )
}
