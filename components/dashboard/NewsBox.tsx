'use client'

import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { generateMatchNews } from '@/lib/newsTemplates'

export type ScheduleMatch = {
  id: number
  kickoff_at: string
  status: string
  home_score: number | null
  away_score: number | null
  home_team: { short_name: string | null; logo_url: string | null } | null
  away_team: { short_name: string | null; logo_url: string | null } | null
  round: { season: { tournament: { name: string; logo_url: string | null } | null } | null } | null
}

type NewsItem = {
  headline: string
  body: string
  match: ScheduleMatch
}

export default function NewsBox({ matches }: { matches: ScheduleMatch[] }) {
  const [activeIndex, setActiveIndex] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const news = useMemo<NewsItem[]>(() => {
    return matches.map((m) => {
      const home = m.home_team?.short_name ?? '?'
      const away = m.away_team?.short_name ?? '?'
      const tournament = m.round?.season?.tournament?.name ?? ''
      const template = generateMatchNews(home, away, m.home_score ?? 0, m.away_score ?? 0, tournament)
      return { headline: template.headline, body: template.body, match: m }
    })
  }, [matches])

  const resetInterval = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    if (news.length > 1) {
      intervalRef.current = setInterval(() => {
        setActiveIndex((i) => (i + 1) % news.length)
      }, 20000)
    }
  }, [news.length])

  useEffect(() => {
    resetInterval()
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [resetInterval])

  function handleClick(i: number) {
    setActiveIndex(i)
    resetInterval()
  }

  if (news.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-black/8 overflow-hidden h-full flex flex-col justify-center">
        <p className="text-[10px] font-bold text-[#7a7060] uppercase tracking-wider px-5 pt-4 pb-2">
          Bodega Bets Nyheder
        </p>
        <p className="text-[12px] text-[#7a7060] px-5 pb-4">Ingen kampe i går</p>
      </div>
    )
  }

  const activeNews = news[activeIndex] ?? news[0]

  return (
    <div className="bg-white rounded-2xl border border-black/8 overflow-hidden h-full flex flex-col">
      <p className="text-[10px] font-bold text-[#7a7060] uppercase tracking-wider px-5 pt-4 pb-2">
        Bodega Bets Nyheder
      </p>

      <div className="flex flex-1 min-h-0">
        {/* Venstre — overskrifter */}
        <div className="w-[160px] shrink-0 border-r border-black/8 py-2">
          {news.map((n, i) => (
            <button
              key={i}
              onClick={() => handleClick(i)}
              className={`w-full text-left px-4 py-2 text-[11px] font-semibold leading-tight transition-colors ${
                i === activeIndex ? 'text-[#1a3329] bg-black/4' : 'text-[#7a7060]'
              }`}
            >
              {n.headline}
            </button>
          ))}
        </div>

        {/* Højre — aktiv nyhed */}
        <div className="flex-1 px-4 py-3 min-h-[140px]">
          {/* Hold logoer overlappende */}
          <div className="flex items-center mb-3 relative h-8">
            {activeNews.match.home_team?.logo_url && (
              <img
                src={activeNews.match.home_team.logo_url}
                alt=""
                className="w-8 h-8 rounded-full border-2 border-white z-10 relative object-contain"
              />
            )}
            {activeNews.match.away_team?.logo_url && (
              <img
                src={activeNews.match.away_team.logo_url}
                alt=""
                className="w-8 h-8 rounded-full border-2 border-white -ml-2 object-contain"
              />
            )}
            <span className="ml-2 text-[11px] text-[#7a7060]">
              {activeNews.match.home_score ?? 0}-{activeNews.match.away_score ?? 0}
            </span>
          </div>

          <p className="text-[13px] text-[#1a3329] leading-relaxed">{activeNews.body}</p>

          {/* Auto-progress indikator */}
          <div className="flex gap-1 mt-3">
            {news.map((_, i) => (
              <div
                key={i}
                className={`h-1 rounded-full flex-1 ${i === activeIndex ? 'bg-[#1a3329]' : 'bg-black/10'}`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
