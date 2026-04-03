import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="bg-cream border-t border-[#d4cfc4] mt-auto">
      <div className="max-w-5xl mx-auto px-5 py-6">

        {/* Mobil: alt stacked centreret. Desktop: tre kolonner */}
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between sm:items-center">

          {/* Logo */}
          <Link href="/" aria-label="Bodega Bets">
            <span style={{ fontFamily: "'Kingdrops Script', cursive", fontSize: '20px', letterSpacing: '-1px', lineHeight: 1, color: '#1C3829' }}>
              Bodega Bets
            </span>
          </Link>

          {/* Tagline — skjules på meget små skærme */}
          <p className="hidden sm:block text-[10px] tracking-widest uppercase text-[#9a9080] text-center">
            Spil med vennerne. Ingen rigtige penge.
          </p>

          {/* Copyright + Stæhrs branding */}
          <div className="text-right">
            <p className="text-[10px] text-[#b0a898]">
              © {new Date().getFullYear()} Bodega Bets
            </p>
            <p className="text-[10px] text-[#b0a898]">
              A{' '}
              <a
                href="https://xn--sthrs-tra.dk"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-ink transition-colors"
                style={{ fontFamily: "'Archivo Black', sans-serif", fontWeight: 400, color: 'inherit' }}
              >
                Stæhrs.
              </a>
              {' '}product
            </p>
          </div>

        </div>

        {/* Juridiske links */}
        <div className="flex flex-wrap items-center justify-center gap-4 mt-2">
          <Link href="/privatlivspolitik" className="text-[11px] text-warm-gray hover:text-ink transition-colors">
            Privatlivspolitik
          </Link>
          <Link href="/cookie-politik" className="text-[11px] text-warm-gray hover:text-ink transition-colors">
            Cookie politik
          </Link>
          <Link href="/vilkaar" className="text-[11px] text-warm-gray hover:text-ink transition-colors">
            Vilkår og betingelser
          </Link>
        </div>
      </div>
    </footer>
  )
}
