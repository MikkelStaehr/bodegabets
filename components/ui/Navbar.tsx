'use client'

import Link from 'next/link'
import UserMenu from '@/components/ui/UserMenu'
import { useLiveMatches } from '@/hooks/useLiveMatches'
import { useLiveMatchesContext } from '@/contexts/LiveMatchesContext'

type Props = {
  username?: string
  points?: number
  isAdmin?: boolean
  backHref?: string
  backLabel?: string
  gameId?: number
  activeRoundId?: number | null
}

export default function Navbar({ username, points, isAdmin, backHref, backLabel, gameId, activeRoundId }: Props) {
  const ctx = useLiveMatchesContext()
  const hookData = useLiveMatches(activeRoundId ?? null, !!activeRoundId && !ctx)
  const summary = ctx?.summary ?? hookData.summary
  const liveCount = summary.live + summary.halftime

  return (
    <nav className="bg-forest border-b-2 border-forest-light px-4 py-0">
      <div className="max-w-5xl mx-auto h-14 flex items-center justify-between gap-4">

        {/* Venstre: evt. tilbage-pil + logo */}
        <div className="flex items-center gap-3">
          {backHref && (
            <Link
              href={backHref}
              aria-label={backLabel ?? 'Tilbage'}
              className="text-cream/60 hover:text-cream transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
          )}
          <Link href="/" className="flex items-center" aria-label="Bodega Bets">
            <span style={{ display: 'inline-flex', alignItems: 'baseline', lineHeight: 1, whiteSpace: 'nowrap' }}>
              <span style={{ fontFamily: "var(--font-lobster), 'Lobster', cursive", fontSize: '32px', color: '#F2EDE4', marginRight: '-4px' }}>B</span>
              <span style={{ fontFamily: "var(--font-pacifico), 'Pacifico', cursive", fontSize: '16px', color: '#F2EDE4' }}>odega</span>
              <span style={{ display: 'inline-block', width: '4px' }} />
              <span style={{ fontFamily: "var(--font-lobster), 'Lobster', cursive", fontSize: '32px', color: '#F2EDE4', marginRight: '-4px' }}>B</span>
              <span style={{ fontFamily: "var(--font-pacifico), 'Pacifico', cursive", fontSize: '16px', color: '#F2EDE4' }}>ets</span>
            </span>
          </Link>
          {gameId && (
            <Link href={`/games/${gameId}`} className="relative flex items-center gap-2 pl-1 font-condensed text-sm text-cream/80 hover:text-cream transition-colors">
              Spilrum
              {liveCount > 0 && (
                <span className="absolute -top-1 -right-1 flex items-center justify-center w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-black animate-pulse shadow-sm">
                  {liveCount}
                </span>
              )}
            </Link>
          )}
        </div>

        {/* Højre: bruger-dropdown eller gæste-links */}
        {username ? (
          <UserMenu username={username} points={points ?? 0} isAdmin={isAdmin} />
        ) : (
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/login"
              className="font-condensed font-semibold text-sm uppercase tracking-wide text-cream/70 hover:text-cream transition-colors"
            >
              Log ind
            </Link>
            <Link
              href="/register"
              className="font-condensed font-semibold text-xs sm:text-sm uppercase tracking-wide bg-cream text-forest px-3 sm:px-4 py-2 hover:opacity-90 transition-opacity whitespace-nowrap"
              style={{ borderRadius: '2px' }}
            >
              <span className="hidden sm:inline">Opret konto</span>
              <span className="sm:hidden">Opret</span>
            </Link>
          </div>
        )}
      </div>
    </nav>
  )
}
