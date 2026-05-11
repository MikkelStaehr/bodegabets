'use client'

import { useEffect, useRef } from 'react'

export type TickerPart =
  | { type: 'logo'; url: string }
  | { type: 'text'; text: string }

export type LandingTickerItem = {
  /** Sekvens af logo + tekst-fragmenter, render'es inline i orden.
   *  Eksempel for fodbold:
   *    [logo home] ' Liverpool – ' [logo away] ' Chelsea · Lør 17:30' */
  parts: TickerPart[]
  /** Plain-text version til dedup/accessibility */
  text: string
  /** Optional href hvis hele item skal være klikbart (ikke brugt nu) */
  href?: string
}

interface Props {
  items: LandingTickerItem[]
  /** Server-rendered datostreng. Bruges på sider med revalidate (fx landing-v2)
   *  så vi undgår hydration mismatch når cache spænder over midnat. */
  currentDate?: string
}

export default function LandingTicker({ items, currentDate }: Props) {
  const innerRef = useRef<HTMLDivElement>(null)
  const hasDuplicated = useRef(false)

  // Dedup på tekst
  const uniqueItems = items.filter(
    (item, i, arr) => arr.findIndex((x) => x.text === item.text) === i,
  )

  // Dublér indhold for seamless loop
  useEffect(() => {
    const el = innerRef.current
    if (!el || !uniqueItems.length || hasDuplicated.current) return
    el.innerHTML += el.innerHTML
    hasDuplicated.current = true
  }, [uniqueItems])

  if (!uniqueItems.length) return null

  return (
    <div
      className="flex items-center overflow-hidden h-[34px] border-b border-white/5"
      style={{ background: '#0f1f1a' }}
    >
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
        style={{
          maskImage:
            'linear-gradient(to right, transparent 0%, black 3%, black 97%, transparent 100%)',
        }}
      >
        <div
          ref={innerRef}
          className="flex items-center whitespace-nowrap ticker-scroll"
          style={{ animation: 'ticker-scroll 60s linear infinite' }}
          onMouseEnter={(e) => (e.currentTarget.style.animationPlayState = 'paused')}
          onMouseLeave={(e) => (e.currentTarget.style.animationPlayState = 'running')}
        >
          {uniqueItems.map((item, i) => (
            <span key={i} className="flex items-center px-5">
              {item.parts.map((part, idx) =>
                part.type === 'logo' ? (
                  <img
                    key={`${i}-${idx}`}
                    src={part.url}
                    alt=""
                    className="object-contain shrink-0 mx-1"
                    style={{ width: 16, height: 16 }}
                    loading="lazy"
                  />
                ) : (
                  <span
                    key={`${i}-${idx}`}
                    className="font-body text-xs"
                    style={{ color: 'rgba(242,237,228,0.78)', letterSpacing: '0.01em' }}
                  >
                    {part.text}
                  </span>
                ),
              )}
              <span className="ml-2" style={{ color: '#B8963E', opacity: 0.4, fontSize: 14 }}>·</span>
            </span>
          ))}
        </div>
      </div>

      {/* Dato til højre */}
      <div className="ml-auto shrink-0 pl-6 pr-4 text-[11px] text-white/60 font-medium">
        {currentDate ??
          new Date().toLocaleDateString('da-DK', {
            timeZone: 'Europe/Copenhagen',
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
