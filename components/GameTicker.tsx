'use client'

import { useEffect, useRef } from 'react'

interface Props {
  items: string[]
}

export default function GameTicker({ items }: Props) {
  const innerRef = useRef<HTMLDivElement>(null)
  const hasDuplicated = useRef(false)

  const uniqueItems = items.filter((item, i, arr) => arr.indexOf(item) === i)

  // Dublér indhold for seamless loop — kun én gang (items-reference kan ændre sig ved re-render)
  useEffect(() => {
    const el = innerRef.current
    if (!el || !uniqueItems.length || hasDuplicated.current) return
    el.innerHTML += el.innerHTML
    hasDuplicated.current = true
  }, [uniqueItems])

  if (!uniqueItems.length) return null

  return (
    <div className="flex items-center overflow-hidden h-[34px] border-b border-white/5"
      style={{ background: '#0f1f1a' }}>

      {/* LIVE label */}
      <div
        className="shrink-0 h-full flex items-center px-3 font-condensed font-bold text-[10px] tracking-[0.14em] uppercase z-10"
        style={{ background: '#B8963E', color: '#0f1f1a' }}
      >
        LIVE
      </div>

      {/* Scrolling track */}
      <div
        className="flex-1 overflow-hidden relative flex items-center"
        style={{ maskImage: 'linear-gradient(to right, transparent 0%, black 3%, black 97%, transparent 100%)' }}
      >
        <div
          ref={innerRef}
          className="flex items-center whitespace-nowrap ticker-scroll"
          style={{ animation: 'ticker-scroll 60s linear infinite' }}
          onMouseEnter={(e) => (e.currentTarget.style.animationPlayState = 'paused')}
          onMouseLeave={(e) => (e.currentTarget.style.animationPlayState = 'running')}
        >
          {uniqueItems.map((item, i) => (
            <span key={i} className="flex items-center">
              <span
                className="px-5 font-body text-xs"
                style={{ color: 'rgba(242,237,228,0.75)', letterSpacing: '0.01em' }}
              >
                {item}
              </span>
              <span style={{ color: '#B8963E', opacity: 0.4, fontSize: 14 }}>·</span>
            </span>
          ))}
        </div>
      </div>

      {/* Dato til højre */}
      <div className="ml-auto shrink-0 pl-6 pr-4 text-[11px] text-white/60 font-medium">
        {new Date().toLocaleDateString('da-DK', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
        })}
      </div>

      <style>{`
        @keyframes ticker-scroll {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  )
}
