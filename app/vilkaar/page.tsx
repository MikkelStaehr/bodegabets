import Link from 'next/link'

export default function VilkaarPage() {
  return (
    <div className="min-h-screen bg-cream">
      <div className="max-w-[640px] mx-auto px-6 py-16">
        <Link href="/" className="font-body text-warm-gray text-sm hover:text-ink transition-colors mb-8 block">
          ← Tilbage
        </Link>
        <h1 className="font-display italic text-ink mb-8" style={{ fontWeight: 700, fontSize: 40 }}>
          Vilkår og betingelser
        </h1>
        <div className="font-body text-warm-gray text-sm leading-relaxed space-y-6">
          <p>Bodega Bets er en gratis, privat underholdningsplatform. Der spilles ikke om rigtige penge.</p>
          <h2 className="font-condensed text-ink text-sm uppercase tracking-widest" style={{ fontWeight: 700 }}>Brug af tjenesten</h2>
          <p>Bodega Bets må kun bruges til privat underholdning. Det er ikke tilladt at bruge platformen til kommercielle formål eller i strid med gældende lovgivning.</p>
          <h2 className="font-condensed text-ink text-sm uppercase tracking-widest" style={{ fontWeight: 700 }}>Ingen pengespil</h2>
          <p>Alle points på Bodega Bets er virtuelle og har ingen pengeværdi. Platformen er ikke et pengespilssite og er ikke underlagt spillelovgivning.</p>
          <h2 className="font-condensed text-ink text-sm uppercase tracking-widest" style={{ fontWeight: 700 }}>Ansvarsbegrænsning</h2>
          <p>Bodega Bets udbydes som det er. Vi garanterer ikke uafbrudt adgang og er ikke ansvarlige for tab af data eller andre tab som følge af brug af tjenesten.</p>
          <h2 className="font-condensed text-ink text-sm uppercase tracking-widest" style={{ fontWeight: 700 }}>Ændringer</h2>
          <p>Vi forbeholder os retten til at ændre disse vilkår. Væsentlige ændringer vil blive kommunikeret til registrerede brugere.</p>
        </div>
      </div>
    </div>
  )
}
