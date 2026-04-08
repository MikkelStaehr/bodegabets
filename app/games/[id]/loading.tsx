'use client'

import { useState, useEffect } from 'react'
import HideNav from '@/components/layout/HideNav'

export default function GameRoomLoading() {
  const [sport, setSport] = useState<string>('football')

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem('game-sport')
      if (stored) setSport(stored)
    } catch {}
  }, [])

  const isCycling = sport === 'cycling'
  const bg = isCycling ? '#1E3A5F' : '#1a3329'
  const barBg = isCycling ? '#1A4F7A' : '#2C4A3E'

  return (
    <div className="fixed inset-0 z-[300] flex flex-col items-center justify-center gap-6" style={{ background: bg }}>
      <HideNav />
      <div className="flex flex-col items-center gap-4">
        <span className="logo-font" style={{ fontSize: 'clamp(48px, 12vw, 96px)', color: '#F2EDE4' }}>
          bodega bets
        </span>
        {isCycling && (
          <span
            className="font-condensed"
            style={{ fontSize: 13, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#C9A84C' }}
          >
            Cycling Manager
          </span>
        )}
        <span
          className="font-condensed text-[13px] font-bold tracking-widest uppercase text-[#B8963E]"
        >
          Indlæser spilrum...
        </span>
      </div>
      <div className="w-48 h-[2px] rounded overflow-hidden" style={{ background: barBg }}>
        <div className="h-full bg-[#B8963E] rounded animate-[loading_1.2s_ease-in-out_infinite]" />
      </div>
      <style>{`
        @keyframes loading {
          0% { width: 0%; margin-left: 0%; }
          50% { width: 60%; margin-left: 20%; }
          100% { width: 0%; margin-left: 100%; }
        }
      `}</style>
    </div>
  )
}
