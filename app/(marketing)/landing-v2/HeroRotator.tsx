'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

type Slide = {
  id: string
  label: string
  image: string
  /** Optional tint overlay class for differentiation */
  tint?: string
  /** object-position helper to frame the photo */
  position?: string
}

const SLIDES: readonly Slide[] = [
  {
    id: 'football',
    label: 'Fodbold',
    image: '/img/herobannerfootball.jpg',
    position: 'object-center',
  },
  {
    id: 'cycling',
    label: 'Cykling',
    image: '/img/herocyclingsprint.jpg',
    position: 'object-center',
  },
  {
    id: 'championship',
    label: 'Bodega Championship',
    image: '/img/walkoutpitchfootball.jpg',
    position: 'object-center',
    // Subtle gold wash to brand the championship slide differently
    tint: 'bg-gradient-to-br from-gold/25 via-forest/30 to-forest/60',
  },
] as const

export default function HeroRotator({ leagueCount }: { leagueCount: number }) {
  const [active, setActive] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setActive((v) => (v + 1) % SLIDES.length)
    }, 5500)
    return () => clearInterval(interval)
  }, [])

  return (
    <section className="relative w-full h-[480px] lg:h-[620px] overflow-hidden bg-forest">
      {/* Background slides — crossfade with continuous Ken Burns */}
      {SLIDES.map((slide, i) => {
        const isActive = i === active
        return (
          <div
            key={slide.id}
            className="absolute inset-0"
            style={{
              opacity: isActive ? 1 : 0,
              transition: 'opacity 1.6s ease-in-out',
            }}
            aria-hidden={!isActive}
          >
            <img
              src={slide.image}
              alt=""
              className={
                'absolute inset-0 w-full h-full object-cover animate-kenburns ' +
                (slide.position ?? 'object-center')
              }
              // Eager-load first slide so hero looks instant
              loading={i === 0 ? 'eager' : 'lazy'}
              fetchPriority={i === 0 ? 'high' : 'auto'}
            />
            {/* Optional per-slide tint */}
            {slide.tint && (
              <div className={'absolute inset-0 ' + slide.tint + ' pointer-events-none'} />
            )}
          </div>
        )
      })}

      {/* Editorial vignette: top fade + heavy bottom anchor for text legibility */}
      <div className="absolute inset-0 bg-gradient-to-b from-forest/60 via-forest/40 to-forest/95 pointer-events-none" />
      {/* Side vignette for cinematic feel */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 40%, rgba(26,51,41,0.55) 100%)',
        }}
      />

      {/* Content */}
      <div className="relative h-full max-w-6xl mx-auto px-6 lg:px-8 flex flex-col">
        {/* Sport pills */}
        <div className="flex flex-wrap gap-2 pt-8">
          {SLIDES.map((slide, i) => {
            const isActive = i === active
            return (
              <button
                key={slide.id}
                type="button"
                onClick={() => setActive(i)}
                className={
                  'px-4 py-1.5 rounded-full font-condensed font-semibold text-[11px] uppercase tracking-[0.14em] transition-colors duration-300 cursor-pointer ' +
                  (isActive
                    ? 'bg-gold text-forest border border-gold'
                    : 'border border-cream/40 text-cream/60 hover:text-cream hover:border-cream/70')
                }
                aria-pressed={isActive}
              >
                {slide.label}
              </button>
            )
          })}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Headline */}
        <div className="pb-12 lg:pb-16 max-w-3xl">
          <h1
            className="font-display font-black text-cream text-[44px] lg:text-[80px] drop-shadow-[0_2px_12px_rgba(0,0,0,0.4)]"
            style={{ lineHeight: 0.95 }}
          >
            To spil. Én pris.
            <br />
            <span className="text-gold">Et samlingspunkt.</span>
          </h1>

          <p className="mt-6 font-body text-[18px] text-cream/85 max-w-[540px] leading-relaxed drop-shadow-[0_1px_6px_rgba(0,0,0,0.4)]">
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
              className="inline-flex items-center justify-center px-8 py-4 bg-transparent border border-cream/50 text-cream font-condensed font-bold text-[13px] uppercase tracking-widest rounded-sm hover:border-cream/80 transition-colors backdrop-blur-sm"
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

      {/* Slide-progress indicator (bottom, subtle) */}
      <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-cream/5 pointer-events-none">
        <div
          key={active}
          className="h-full bg-gold/70"
          style={{
            animation: 'slideProgress 5.5s linear forwards',
          }}
        />
      </div>

      <style>{`
        @keyframes slideProgress {
          from { width: 0%; }
          to   { width: 100%; }
        }
      `}</style>
    </section>
  )
}
