'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

type Sport = {
  id: 'fodbold' | 'cykling' | 'championship'
  label: string
  image: string
  secondaryHeadline: string
  ctaText: string
  ctaHref: string
}

const SPORTS: readonly Sport[] = [
  {
    id: 'fodbold',
    label: 'Fodbold',
    image: '/img/herobannerfootball.jpg',
    secondaryHeadline: 'Tip kampene.',
    ctaText: 'Start en fodbold-liga →',
    ctaHref: '/games/new?sport=football',
  },
  {
    id: 'cykling',
    label: 'Cykling',
    image: '/img/herocyclingsprint.jpg',
    secondaryHeadline: 'Følg hele sæsonen.',
    ctaText: 'Start en cykel-liga →',
    ctaHref: '/games/new?sport=cycling',
  },
  {
    id: 'championship',
    label: 'Bodega Championship',
    image: '/img/walkoutpitchfootball.jpg',
    secondaryHeadline: 'Følg Europa.',
    ctaText: 'Start en championship-liga →',
    ctaHref: '/games/new?sport=championship',
  },
] as const

const ROTATE_MS = 5000

type Props = { activeUserCount: number | null }

export default function HeroRotator({ activeUserCount }: Props) {
  const [active, setActive] = useState(0)
  const [autoRotate, setAutoRotate] = useState(true)
  const hoverRef = useRef(false)

  // Auto-rotate hver 5s indtil bruger interagerer (klik eller hover)
  useEffect(() => {
    if (!autoRotate) return
    const interval = setInterval(() => {
      if (hoverRef.current) return
      setActive((v) => (v + 1) % SPORTS.length)
    }, ROTATE_MS)
    return () => clearInterval(interval)
  }, [autoRotate])

  function selectSport(i: number) {
    setActive(i)
    setAutoRotate(false)
  }

  const current = SPORTS[active]

  return (
    <section
      className="relative w-full h-[480px] lg:h-[620px] overflow-hidden bg-forest"
      onMouseEnter={() => { hoverRef.current = true }}
      onMouseLeave={() => { hoverRef.current = false }}
    >
      {/* Background slides — crossfade with continuous Ken Burns */}
      {SPORTS.map((slide, i) => {
        const isActive = i === active
        return (
          <div
            key={slide.id}
            className="absolute inset-0"
            style={{
              opacity: isActive ? 1 : 0,
              transition: 'opacity 800ms ease-in-out',
            }}
            aria-hidden={!isActive}
          >
            <img
              src={slide.image}
              alt=""
              className="absolute inset-0 w-full h-full object-cover object-center animate-kenburns"
              loading={i === 0 ? 'eager' : 'lazy'}
              fetchPriority={i === 0 ? 'high' : 'auto'}
            />
          </div>
        )
      })}

      {/* Editorial vignette: top fade + heavy bottom anchor for text legibility */}
      <div className="absolute inset-0 bg-gradient-to-b from-forest/60 via-forest/40 to-forest/95 pointer-events-none" />
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
          {SPORTS.map((sport, i) => {
            const isActive = i === active
            return (
              <button
                key={sport.id}
                type="button"
                onClick={() => selectSport(i)}
                aria-pressed={isActive}
                className={
                  'px-4 py-1.5 rounded-full font-condensed font-semibold text-[11px] uppercase tracking-[0.14em] transition-colors duration-300 cursor-pointer ' +
                  (isActive
                    ? 'bg-gold text-forest border border-gold'
                    : 'border border-cream/40 text-cream/60 hover:text-cream hover:border-cream/70')
                }
              >
                {sport.label}
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
            <span className="block">To spil. Én pris.</span>
            <span
              key={current.id}
              className="block text-gold"
              style={{ animation: 'fadeUp 0.6s cubic-bezier(0.22,1,0.36,1) both' }}
            >
              {current.secondaryHeadline}
            </span>
          </h1>

          <p className="mt-6 font-body text-[18px] text-cream/85 max-w-[540px] leading-relaxed drop-shadow-[0_1px_6px_rgba(0,0,0,0.4)]">
            Cykel-fantasy. Fodbold-tipping. Og vores eget Bodega Championship
            med automatisk genererede spilrunder fra 20 af Europas største
            ligaer.
          </p>

          {/* CTA row */}
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link
              href={current.ctaHref}
              key={current.id + '-cta'}
              className="inline-flex items-center justify-center px-8 py-4 bg-gold text-forest font-condensed font-bold text-[13px] uppercase tracking-widest rounded-sm hover:opacity-90 transition-opacity"
              style={{ animation: 'fadeUp 0.5s cubic-bezier(0.22,1,0.36,1) both' }}
            >
              {current.ctaText}
            </Link>
            <Link
              href="#products"
              className="inline-flex items-center justify-center px-8 py-4 bg-transparent border border-cream/50 text-cream font-condensed font-bold text-[13px] uppercase tracking-widest rounded-sm hover:border-cream/80 transition-colors backdrop-blur-sm"
            >
              Se de to spil
            </Link>

            {activeUserCount !== null && activeUserCount >= 10 && (
              <div className="flex items-center gap-2 ml-1">
                <span
                  className="w-2 h-2 rounded-full bg-green-500"
                  style={{ animation: 'pulse 2s ease-in-out infinite' }}
                />
                <span
                  className="text-[12px] text-cream/55"
                  style={{ fontFamily: "'Courier New', monospace" }}
                >
                  {activeUserCount} aktive spillere
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
