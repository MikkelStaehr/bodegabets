import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="bg-cream border-t border-[#d4cfc4] mt-auto">
      <div className="max-w-5xl mx-auto px-5 py-6">

        {/* Mobil: alt stacked centreret. Desktop: tre kolonner */}
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between sm:items-center">

          {/* Logo */}
          <Link href="/" aria-label="Bodega Bets">
            <span style={{ display: 'inline-flex', alignItems: 'baseline', lineHeight: 1, whiteSpace: 'nowrap' }}>
              <span style={{ fontFamily: "var(--font-lobster), 'Lobster', cursive", fontSize: '20px', color: '#1e2a1e', marginRight: '-4px' }}>B</span>
              <span style={{ fontFamily: "var(--font-pacifico), 'Pacifico', cursive", fontSize: '10px', color: '#1e2a1e' }}>odega</span>
              <span style={{ display: 'inline-block', width: '4px' }} />
              <span style={{ fontFamily: "var(--font-lobster), 'Lobster', cursive", fontSize: '20px', color: '#1e2a1e', marginRight: '-4px' }}>B</span>
              <span style={{ fontFamily: "var(--font-pacifico), 'Pacifico', cursive", fontSize: '10px', color: '#1e2a1e' }}>ets</span>
            </span>
          </Link>

          {/* Tagline — skjules på meget små skærme */}
          <p className="hidden sm:block text-[10px] tracking-widest uppercase text-[#9a9080] text-center">
            Spil med vennerne. Ingen rigtige penge.
          </p>

          {/* Copyright */}
          <p className="text-[10px] text-[#b0a898]">
            © {new Date().getFullYear()} Bodega Bets
          </p>

        </div>
      </div>
    </footer>
  )
}
