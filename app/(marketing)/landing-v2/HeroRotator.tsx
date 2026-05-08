'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'

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
  const [hovered, setHovered] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])

  // Detect prefers-reduced-motion
  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducedMotion(mq.matches)
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches)
    mq.addEventListener?.('change', handler)
    return () => mq.removeEventListener?.('change', handler)
  }, [])

  // Auto-rotate hver 6s indtil bruger interagerer eller hover'er
  // Disabled helt hvis prefers-reduced-motion
  useEffect(() => {
    if (!autoRotate || reducedMotion || hovered) return
    const interval = setInterval(() => {
      setActive((v) => (v + 1) % SLIDES.length)
    }, ROTATE_MS)
    return () => clearInterval(interval)
  }, [autoRotate, reducedMotion, hovered, active])

  function selectSlide(i: number) {
    setActive(i)
    setAutoRotate(false)
  }

  function handleTabKeyDown(e: React.KeyboardEvent, i: number) {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault()
      const next =
        e.key === 'ArrowRight'
          ? (i + 1) % SLIDES.length
          : (i - 1 + SLIDES.length) % SLIDES.length
      selectSlide(next)
      tabRefs.current[next]?.focus()
    }
  }

  const current = SLIDES[active]

  return (
    <section
      className="relative w-full h-[480px] lg:h-[620px] overflow-hidden bg-forest"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Local keyframes for tab underline animations */}
      <style>{`
        @keyframes heroTabProgress {
          from { transform: scaleX(0); }
          to   { transform: scaleX(1); }
        }
        @keyframes heroTabSnap {
          from { transform: scaleX(0); }
          to   { transform: scaleX(1); }
        }
      `}</style>

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
            <Image
              src={slide.image}
              alt=""
              fill
              sizes="100vw"
              priority={i === 0}
              quality={75}
              className="object-cover object-center animate-kenburns"
              style={slide.brightness ? { filter: `brightness(${slide.brightness})` } : undefined}
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
        {/* Top spacer */}
        <div className="flex-1 min-h-8" />

        {/* Headline + subtitle + CTAs — pb generøs så der er plads til tabs nedenfor */}
        <div className="pb-28 lg:pb-36 max-w-3xl">
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

      {/* Bottom-center underline tab bar — full-width hairline divider above */}
      <div className="absolute left-0 right-0 bottom-0 pointer-events-none">
        <div aria-hidden className="w-full border-t border-gold/25" />
        <div
          role="tablist"
          aria-label="Vælg spil"
          className="pointer-events-auto flex justify-center gap-8 lg:gap-12 mt-6 pb-6 lg:pb-10"
        >
          {SLIDES.map((slide, i) => {
            const isActive = i === active
            return (
              <button
                key={slide.id}
                ref={(el) => { tabRefs.current[i] = el }}
                role="tab"
                type="button"
                aria-selected={isActive}
                tabIndex={isActive ? 0 : -1}
                onClick={() => selectSlide(i)}
                onKeyDown={(e) => handleTabKeyDown(e, i)}
                className="group relative py-3 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/60 rounded-sm"
              >
                <span
                  className={
                    'block font-condensed font-bold text-[13px] uppercase tracking-widest transition-colors duration-200 ' +
                    (isActive
                      ? 'text-cream'
                      : 'text-cream/55 group-hover:text-cream/80')
                  }
                >
                  {slide.pillLabel}
                </span>

                {/* Underline track */}
                <div className="relative h-[2px] mt-2 w-full overflow-hidden">
                  {/* Inactive hover line (cream/30) */}
                  {!isActive && (
                    <div
                      aria-hidden
                      className="absolute inset-0 bg-cream/30 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                    />
                  )}

                  {/* Active line — auto-progress eller manual snap */}
                  {isActive &&
                    (reducedMotion ? (
                      <div
                        aria-hidden
                        className="absolute inset-0 bg-gold origin-left"
                        style={{ transform: 'scaleX(1)' }}
                      />
                    ) : autoRotate ? (
                      <div
                        aria-hidden
                        key={'auto-' + active}
                        className="absolute inset-0 bg-gold origin-left"
                        style={{
                          animation: `heroTabProgress ${ROTATE_MS}ms linear forwards`,
                          animationPlayState: hovered ? 'paused' : 'running',
                        }}
                      />
                    ) : (
                      <div
                        aria-hidden
                        key={'manual-' + active}
                        className="absolute inset-0 bg-gold origin-left"
                        style={{
                          animation: 'heroTabSnap 400ms ease-out forwards',
                        }}
                      />
                    ))}
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </section>
  )
}
