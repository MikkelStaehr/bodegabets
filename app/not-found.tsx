import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#F2EDE4] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md text-center">
        <p
          className="font-condensed text-xs uppercase tracking-[0.14em] mb-3"
          style={{ color: '#7a7060' }}
        >
          Fejl 404
        </p>
        <h1
          className="font-display text-5xl font-bold mb-4 leading-none"
          style={{ color: '#1a3329' }}
        >
          Siden findes ikke
        </h1>
        <p className="font-body text-[#5C5C4A] mb-10">
          Linket er muligvis udløbet, eller siden er blevet flyttet.
          Du kan altid komme tilbage til dit dashboard.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/dashboard"
            className="px-6 py-3 rounded-sm bg-[#1a3329] text-[#F2EDE4] font-condensed font-bold text-sm uppercase tracking-[0.08em] hover:bg-[#2c4a3e] transition-colors"
          >
            Til dashboard
          </Link>
          <Link
            href="/"
            className="px-6 py-3 rounded-sm border border-[#1a3329] text-[#1a3329] font-condensed font-bold text-sm uppercase tracking-[0.08em] hover:bg-[#1a3329]/5 transition-colors"
          >
            Forside
          </Link>
        </div>
      </div>
    </div>
  )
}
