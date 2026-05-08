'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

const SPORTS = [
  { id: 'football', label: 'Fodbold' },
  { id: 'cycling', label: 'Cykling' },
  { id: 'championship', label: 'Bodega Championship' },
] as const

const SLIDE_GRADIENTS = [
  'bg-gradient-to-br from-forest via-forest-light to-forest',
  'bg-gradient-to-br from-forest via-forest to-forest-light',
  'bg-gradient-to-br from-forest-light via-forest to-forest',
] as const

type Props = { leagueCount: number }

export default function HeroRotator({ leagueCount }: Props) {
  const [active, setActive] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setActive((v) => (v + 1) % SPORTS.length)
    }, 4000)
    return () => clearInterval(interval)
  }, [])

  return (
    <section className="relative w-full h-[480px] lg:h-[560px] overflow-hidden">
      {/* Background slides */}
      {SLIDE_GRADIENTS.map((gradient, i) => (
        <div
          key={i}
          className={`absolute inset-0 ${gradient}`}
          style={{
            opacity: i === active ? 1 : 0,
            transition: 'opacity 1.4s ease-in-out',
          }}
        />
      ))}

      {/* Dark overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-forest/40 to-forest/95 pointer-events-none" />

      {/* Content */}
      <div className="relative h-full max-w-6xl mx-auto px-6 lg:px-8 flex flex-col">
        {/* Sport pills */}
        <div className="flex flex-wrap gap-2 pt-8">
          {SPORTS.map((sport, i) => {
            const isActive = i === active
            return (
              <span
                key={sport.id}
                className={
                  'px-4 py-1.5 rounded-full font-condensed font-semibold text-[11px] uppercase tracking-[0.14em] transition-colors duration-300 ' +
                  (isActive
                    ? 'bg-gold text-forest border border-gold'
                    : 'border border-cream/40 text-cream/60')
                }
              >
                {sport.label}
              </span>
            )
          })}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Headline */}
        <div className="pb-12 lg:pb-16 max-w-3xl">
          <h1
            className="font-display font-black text-cream text-[44px] lg:text-[76px]"
            style={{ lineHeight: 0.95 }}
          >
            To spil. Én pris.
            <br />
            <span className="text-gold">Et samlingspunkt.</span>
          </h1>

          <p className="mt-6 font-body text-[18px] text-cream/85 max-w-[540px] leading-relaxed">
            Fantasy Cycling Manager. Football Sports Betting. Og vores egen
            Bodega Bet Championship med automatisk genererede spilrunder fra
            20 af Europas største ligaer.
          </p>

          {/* CTA row */}
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link
              href="/games/new"
              className="inline-flex items-center justify-center px-8 py-4 bg-gold text-forest font-condensed font-bold text-[13px] uppercase tracking-widest rounded-sm hover:opacity-90 transition-opacity"
            >
              Start en liga →
            </Link>
            <Link
              href="#products"
              className="inline-flex items-center justify-center px-8 py-4 bg-transparent border border-cream/50 text-cream font-condensed font-bold text-[13px] uppercase tracking-widest rounded-sm hover:border-cream/80 transition-colors"
            >
              Se de to spil
            </Link>

            <div className="flex items-center gap-2 ml-1">
              <span
                className="w-2 h-2 rounded-full bg-green-500"
                style={{ animation: 'pulse 2s ease-in-out infinite' }}
              />
              <span
                className="text-[12px] text-cream/55 font-mono"
                style={{ fontFamily: "'Courier New', monospace" }}
              >
                {leagueCount} ligaer aktive lige nu
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
