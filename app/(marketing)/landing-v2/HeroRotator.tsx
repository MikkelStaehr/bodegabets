'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

type Slide = {
  id: 'fodbold' | 'cykling'
  pillLabel: string
  image: string
  /** CSS filter brightness multiplier — bruges hvis råbillede er for lyst i forhold til
   *  hero-mood'en. Default 1 (uændret). */
  brightness?: number
  headlinePrimary: string
  headlineSecondary: string
  subtitle: string
  ctaText: string
  ctaHref: string
}

const SLIDES: readonly Slide[] = [
  {
    id: 'fodbold',
    pillLabel: 'Fodbold',
    image: '/landing/walkoutpitchfootball.jpg',
    headlinePrimary: 'Tip kampene.',
    headlineSecondary: 'Følg hele Europa.',
    subtitle:
      'Forudsig kampe på tværs af 20 europæiske ligaer. Bet-vinduet låser 30 minutter før kickoff, point opdateres i realtid. Og hver runde samler vores Bodega Championship automatisk de største derbys og rivalopgør på tværs af Europa.',
    ctaText: 'Start en fodbold-liga →',
    ctaHref: '/games/new?sport=football',
  },
  {
    id: 'cykling',
    pillLabel: 'Cykling',
    image: '/landing/herobannercycling2.jpg',
    brightness: 0.7,
    headlinePrimary: 'Saml drømmeholdet.',
    headlineSecondary: 'Følg hele sæsonen.',
    subtitle:
      'Byg dit fantasy-hold til Grand Tours og monumenter. Otte roller per rytter, joker når det gælder, hold-bonusser og DNF-straffe. Point efter hver etape, ligaer hele sæsonen igennem.',
    ctaText: 'Start en cykel-liga →',
    ctaHref: '/games/new?sport=cycling',
  },
] as const

const ROTATE_MS = 6000

type Props = { activeUserCount: number | null }

export default function HeroRotator({ activeUserCount }: Props) {
  const [active, setActive] = useState(0)
  const [autoRotate, setAutoRotate] = useState(true)
  const hoverRef = useRef(false)

  // Hent fallback-image-paths som peger på offentligt /img-mappen i tilfælde af
  // at /landing/-stien ikke findes endnu (placeholders kan mangle i build).
  // Pollerer ikke — svg fallback skjules bare hvis billedet er gyldigt.

  // Auto-rotate hver 6s indtil bruger interagerer — respekterer prefers-reduced-motion
  useEffect(() => {
    if (!autoRotate) return
    if (typeof window === 'undefined') return

    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduced) return

    const interval = setInterval(() => {
      if (hoverRef.current) return
      setActive((v) => (v + 1) % SLIDES.length)
    }, ROTATE_MS)
    return () => clearInterval(interval)
  }, [autoRotate])

  function selectSlide(i: number) {
    setActive(i)
    setAutoRotate(false)
  }

  const current = SLIDES[active]

  return (
    <section
      className="relative w-full h-[480px] lg:h-[620px] overflow-hidden bg-forest"
      onMouseEnter={() => { hoverRef.current = true }}
      onMouseLeave={() => { hoverRef.current = false }}
    >
      {/* Background slides — crossfade with continuous Ken Burns */}
      {SLIDES.map((slide, i) => {
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
              style={slide.brightness ? { filter: `brightness(${slide.brightness})` } : undefined}
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
        {/* Sport pills (top-left) */}
        <div className="flex flex-wrap gap-2 pt-8">
          {SLIDES.map((slide, i) => {
            const isActive = i === active
            return (
              <button
                key={slide.id}
                type="button"
                onClick={() => selectSlide(i)}
                aria-pressed={isActive}
                className={
                  'px-4 py-1.5 rounded-full font-condensed font-semibold text-[11px] uppercase tracking-[0.14em] transition-colors duration-300 cursor-pointer ' +
                  (isActive
                    ? 'bg-gold text-forest'
                    : 'bg-transparent border border-cream/40 text-cream/70 hover:text-cream hover:border-cream/70')
                }
              >
                {slide.pillLabel}
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
            key={current.id + '-h'}
          >
            <span
              className="block"
              style={{ animation: 'fadeUp 0.6s cubic-bezier(0.22,1,0.36,1) both' }}
            >
              {current.headlinePrimary}
            </span>
            <span
              className="block text-gold"
              style={{ animation: 'fadeUp 0.6s 0.05s cubic-bezier(0.22,1,0.36,1) both' }}
            >
              {current.headlineSecondary}
            </span>
          </h1>

          <p
            className="mt-6 font-body text-[18px] text-cream/85 max-w-[560px] leading-relaxed drop-shadow-[0_1px_6px_rgba(0,0,0,0.4)]"
            key={current.id + '-p'}
            style={{ animation: 'fadeUp 0.6s 0.1s cubic-bezier(0.22,1,0.36,1) both' }}
          >
            {current.subtitle}
          </p>

          {/* CTA row */}
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link
              href={current.ctaHref}
              key={current.id + '-cta'}
              className="inline-flex items-center justify-center px-8 py-4 bg-gold text-forest font-condensed font-bold text-[13px] uppercase tracking-widest rounded-sm hover:opacity-90 transition-opacity"
              style={{ animation: 'fadeUp 0.5s 0.15s cubic-bezier(0.22,1,0.36,1) both' }}
            >
              {current.ctaText}
            </Link>
            <Link
              href="#how-it-works"
              className="inline-flex items-center justify-center px-8 py-4 bg-transparent border border-cream/50 text-cream font-condensed font-bold text-[13px] uppercase tracking-widest rounded-sm hover:border-cream/80 transition-colors backdrop-blur-sm"
            >
              Se hvordan det virker
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
