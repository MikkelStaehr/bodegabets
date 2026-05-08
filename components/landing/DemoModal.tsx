'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

// ─── Data ───────────────────────────────────────────────────────────────────

type LeagueId = 'pl' | 'la-liga' | 'serie-a' | 'bodega'
type Tip = '1' | 'X' | '2'

type Match = { home: string; away: string; derby?: string }

type League = {
  id: LeagueId
  name: string
  description: string
  isFlagship?: boolean
}

const LEAGUES: readonly League[] = [
  {
    id: 'pl',
    name: 'Premier League',
    description: 'Engelsk topfodbold. 20 hold, 38 spillerunder.',
  },
  {
    id: 'la-liga',
    name: 'La Liga',
    description: 'Spansk topfodbold. El Clásico, Sevilla-derby og mere.',
  },
  {
    id: 'serie-a',
    name: 'Serie A',
    description: "Italiensk topfodbold. Derby della Madonnina, Derby d'Italia.",
  },
  {
    id: 'bodega',
    name: 'Bodega Championship',
    description: 'Du følger ikke én liga — du følger Europa.',
    isFlagship: true,
  },
] as const

const MATCHES: Record<LeagueId, readonly Match[]> = {
  pl: [
    { home: 'Liverpool', away: 'Arsenal' },
    { home: 'Manchester United', away: 'Chelsea' },
    { home: 'Tottenham', away: 'Newcastle' },
    { home: 'Aston Villa', away: 'Brighton' },
  ],
  'la-liga': [
    { home: 'Real Madrid', away: 'Atlético' },
    { home: 'Barcelona', away: 'Sevilla' },
    { home: 'Valencia', away: 'Villarreal' },
    { home: 'Real Sociedad', away: 'Athletic Bilbao' },
  ],
  'serie-a': [
    { home: 'Inter', away: 'Juventus' },
    { home: 'AC Milan', away: 'Roma' },
    { home: 'Napoli', away: 'Lazio' },
    { home: 'Fiorentina', away: 'Bologna' },
  ],
  bodega: [
    { home: 'Real Madrid', away: 'Barcelona', derby: 'El Clásico' },
    { home: 'Manchester Utd', away: 'Manchester City', derby: 'Manchester Derby' },
    { home: 'Dortmund', away: 'Bayern', derby: 'Der Klassiker' },
    { home: 'Inter', away: 'Milan', derby: 'Derby della Madonnina' },
  ],
} as const

const ODDS: Record<Tip, string> = { '1': '48%', X: '22%', '2': '30%' }

type LeaderRow = {
  pos: number
  name: string
  pts: number
  change: 'up' | 'down' | 'same' | 'new'
  delta?: number
  isUser?: boolean
}

const LEADERBOARD: readonly LeaderRow[] = [
  { pos: 1, name: 'Zidane', pts: 47, change: 'up', delta: 2 },
  { pos: 2, name: 'Dig', pts: 43, change: 'new', isUser: true },
  { pos: 3, name: 'Beckham', pts: 39, change: 'same' },
  { pos: 4, name: 'Maldini', pts: 38, change: 'down', delta: 1 },
  { pos: 5, name: 'Henry', pts: 35, change: 'same' },
  { pos: 6, name: 'Ronaldinho "DNF"', pts: 28, change: 'down', delta: 3 },
] as const

const CHAT_MESSAGES = [
  {
    avatar: 'Z',
    avatarBg: 'bg-gold/20 text-gold',
    name: 'Zidane',
    time: 'for 12 min siden',
    body: 'haha Beckham tippede igen Spurs hjemme 😅',
  },
  {
    avatar: 'B',
    avatarBg: 'bg-cream/20 text-cream',
    name: 'Beckham',
    time: 'for 8 min siden',
    body: 'hold kæft jeg holder fast i mit system',
  },
] as const

// 3 first matches "correct", last "incorrect" — regardless of user's tips.
const CORRECT_FLAGS: readonly boolean[] = [true, true, true, false]

// ─── Component ──────────────────────────────────────────────────────────────

type Props = { open: boolean; onClose: () => void }

export default function DemoModal({ open, onClose }: Props) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
  const [selectedLeague, setSelectedLeague] = useState<LeagueId | null>(null)
  const [tips, setTips] = useState<Record<number, Tip>>({})
  const [reducedMotion, setReducedMotion] = useState(false)
  const [exiting, setExiting] = useState(false)
  const [mounted, setMounted] = useState(false)

  const closeBtnRef = useRef<HTMLButtonElement | null>(null)
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const previousActiveRef = useRef<HTMLElement | null>(null)

  // Detect prefers-reduced-motion once
  useEffect(() => {
    if (typeof window === 'undefined') return
    setReducedMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  }, [])

  // Mount/unmount with exit animation
  useEffect(() => {
    if (open) {
      setMounted(true)
      setExiting(false)
    } else if (mounted) {
      setExiting(true)
      const t = window.setTimeout(() => {
        setMounted(false)
        setExiting(false)
        // Reset state when fully closed
        setStep(1)
        setSelectedLeague(null)
        setTips({})
      }, reducedMotion ? 0 : 200)
      return () => window.clearTimeout(t)
    }
  }, [open, mounted, reducedMotion])

  // Body scroll lock + ESC + initial focus
  useEffect(() => {
    if (!mounted) return

    previousActiveRef.current = document.activeElement as HTMLElement | null
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      } else if (e.key === 'Tab') {
        // Focus trap inside dialog
        if (!dialogRef.current) return
        const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
        if (focusables.length === 0) return
        const first = focusables[0]
        const last = focusables[focusables.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', handleKey)

    // Initial focus on close button
    const focusTimer = window.setTimeout(() => {
      closeBtnRef.current?.focus()
    }, reducedMotion ? 0 : 50)

    return () => {
      document.body.style.overflow = original
      document.removeEventListener('keydown', handleKey)
      window.clearTimeout(focusTimer)
      // Restore focus to triggering element on close
      if (previousActiveRef.current && typeof previousActiveRef.current.focus === 'function') {
        previousActiveRef.current.focus()
      }
    }
  }, [mounted, onClose, reducedMotion])

  if (!mounted) return null

  const currentLeagueMatches = selectedLeague ? MATCHES[selectedLeague] : []
  const tipsCount = Object.keys(tips).length

  function selectLeague(id: LeagueId) {
    setSelectedLeague(id)
    setTips({})
  }

  function setTip(idx: number, t: Tip) {
    setTips((prev) => ({ ...prev, [idx]: t }))
  }

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="demo-step-heading"
      className={`fixed inset-0 z-[100] flex flex-col bg-forest/95 backdrop-blur-md ${
        exiting ? 'demo-modal-exiting' : 'demo-modal-entering'
      }`}
      onClick={(e) => {
        // Close when clicking on the backdrop (the dialog root itself)
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <DemoStyles reducedMotion={reducedMotion} />

      {/* Top bar: skip + close */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 flex-shrink-0">
        <button
          type="button"
          onClick={() => setStep(4)}
          className="font-condensed font-semibold text-[11px] sm:text-[12px] uppercase tracking-widest text-gold/80 hover:text-gold transition-colors min-h-[44px] inline-flex items-center"
        >
          Spring til slutningen →
        </button>

        <button
          ref={closeBtnRef}
          type="button"
          onClick={onClose}
          aria-label="Luk demo"
          className="w-11 h-11 inline-flex items-center justify-center rounded-sm text-cream/70 hover:text-cream hover:bg-cream/5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" d="M6 6l12 12M6 18L18 6" />
          </svg>
        </button>
      </div>

      {/* Step indicator */}
      <div className="flex items-center justify-center gap-2 pb-4 flex-shrink-0">
        {[1, 2, 3, 4].map((n) => (
          <span
            key={n}
            aria-hidden
            className={
              'rounded-full transition-all duration-300 ' +
              (n === step
                ? 'w-2.5 h-2.5 bg-gold'
                : 'w-1.5 h-1.5 bg-cream/30')
            }
          />
        ))}
      </div>

      {/* Step content — scrollable area */}
      <div
        className="flex-1 overflow-y-auto overscroll-contain"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="max-w-3xl mx-auto px-4 sm:px-6 pb-32 sm:pb-24">
          <div
            key={step}
            className="demo-step-anim"
            aria-live="polite"
          >
            {step === 1 && (
              <Step1
                selectedLeague={selectedLeague}
                onSelect={selectLeague}
              />
            )}
            {step === 2 && selectedLeague && (
              <Step2
                league={LEAGUES.find((l) => l.id === selectedLeague)!}
                matches={currentLeagueMatches}
                tips={tips}
                onTip={setTip}
              />
            )}
            {step === 3 && selectedLeague && (
              <Step3
                matches={currentLeagueMatches}
                reducedMotion={reducedMotion}
              />
            )}
            {step === 4 && (
              <Step4 onClose={onClose} />
            )}
          </div>
        </div>
      </div>

      {/* Sticky footer nav */}
      <FooterNav
        step={step}
        canAdvance={
          (step === 1 && selectedLeague !== null) ||
          (step === 2 && tipsCount === 4) ||
          step === 3
        }
        onBack={() => setStep((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3 | 4) : s))}
        onNext={() => setStep((s) => (s < 4 ? ((s + 1) as 1 | 2 | 3 | 4) : s))}
        onClose={onClose}
      />
    </div>
  )
}

// ─── Step 1: Vælg din liga ──────────────────────────────────────────────────

function Step1({
  selectedLeague,
  onSelect,
}: {
  selectedLeague: LeagueId | null
  onSelect: (id: LeagueId) => void
}) {
  return (
    <>
      <StepHeader
        tag="Trin 1 af 4"
        title="Vælg din liga."
        subtitle="Spil på din yndlingsliga, eller lad Bodega Championship samle ugens største kampe fra hele Europa."
      />

      <ul className="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-6 lg:mt-10">
        {LEAGUES.map((league) => {
          const isSelected = selectedLeague === league.id
          return (
            <li key={league.id}>
              <button
                type="button"
                onClick={() => onSelect(league.id)}
                aria-pressed={isSelected}
                className={
                  'w-full text-left p-4 lg:p-6 rounded-sm transition-all min-h-[88px] relative ' +
                  (league.isFlagship && !isSelected
                    ? 'bg-cream/5 border-2 border-gold/60 hover:border-gold/80 '
                    : '') +
                  (!league.isFlagship && !isSelected
                    ? 'bg-cream/5 border border-cream/20 hover:border-gold/60 '
                    : '') +
                  (isSelected ? 'bg-gold/10 border-2 border-gold ' : '')
                }
              >
                {league.isFlagship && (
                  <span className="absolute top-3 right-3 font-condensed font-semibold text-[9px] uppercase tracking-widest text-gold">
                    Vores format
                  </span>
                )}
                <div className="font-display font-bold text-cream text-[20px] lg:text-[22px] leading-tight pr-20">
                  {league.name}
                </div>
                <div className="mt-2 font-body text-[13px] text-cream/70 leading-relaxed">
                  {league.description}
                </div>
              </button>
            </li>
          )
        })}
      </ul>
    </>
  )
}

// ─── Step 2: Tip ugens kampe ────────────────────────────────────────────────

function Step2({
  league,
  matches,
  tips,
  onTip,
}: {
  league: League
  matches: readonly Match[]
  tips: Record<number, Tip>
  onTip: (idx: number, t: Tip) => void
}) {
  const tippedCount = Object.keys(tips).length

  return (
    <>
      <StepHeader
        tag="Trin 2 af 4"
        title="Tip ugens kampe."
        subtitle="Klik på dit bud for hver kamp. Det her er hvad spillerne ser inden kickoff."
      />

      <div className="mt-6 lg:mt-10 space-y-3">
        {matches.map((match, idx) => (
          <div
            key={`${league.id}-${idx}`}
            className="border-b border-cream/10 last:border-b-0 pb-4 last:pb-0"
          >
            {match.derby && (
              <div className="font-condensed font-semibold text-[10px] uppercase tracking-[0.14em] text-gold/80 mb-2">
                {match.derby}
              </div>
            )}

            <div className="font-body text-[15px] text-cream/95">
              {match.home} <span className="text-cream/50">—</span> {match.away}
            </div>

            <div className="grid grid-cols-3 gap-2 mt-3">
              {(['1', 'X', '2'] as Tip[]).map((t) => {
                const isSelected = tips[idx] === t
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => onTip(idx, t)}
                    aria-pressed={isSelected}
                    className={
                      'flex flex-col items-center justify-center min-h-[52px] py-2 rounded-sm border transition-colors ' +
                      (isSelected
                        ? 'bg-gold border-gold text-forest'
                        : 'bg-transparent border-cream/30 text-cream hover:border-gold/60')
                    }
                  >
                    <span className="font-condensed font-bold text-[14px] uppercase">
                      {t}
                    </span>
                    <span
                      className={
                        'mt-0.5 text-[10px] tracking-[0.05em] ' +
                        (isSelected ? 'text-forest/70' : 'text-cream/40')
                      }
                      style={{ fontFamily: "'Courier New', monospace" }}
                    >
                      {ODDS[t]}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      <div
        className="mt-6 text-center text-[14px] text-cream/60"
        style={{ fontFamily: "'Courier New', monospace" }}
      >
        {tippedCount} af {matches.length} tippet
      </div>
    </>
  )
}

// ─── Step 3: Kickoff. Point i realtid. ──────────────────────────────────────

function Step3({
  matches,
  reducedMotion,
}: {
  matches: readonly Match[]
  reducedMotion: boolean
}) {
  const [revealedCount, setRevealedCount] = useState(0)

  useEffect(() => {
    if (reducedMotion) {
      setRevealedCount(matches.length)
      return
    }

    setRevealedCount(0)
    const timeouts: number[] = []
    for (let i = 0; i < matches.length; i++) {
      timeouts.push(
        window.setTimeout(() => setRevealedCount(i + 1), 800 + i * 600),
      )
    }
    return () => timeouts.forEach((t) => window.clearTimeout(t))
  }, [matches.length, reducedMotion])

  // points = correct count revealed so far × 3
  let points = 0
  for (let i = 0; i < revealedCount; i++) {
    if (CORRECT_FLAGS[i]) points += 3
  }

  return (
    <>
      <StepHeader
        tag="Trin 3 af 4"
        title="Kickoff. Point i realtid."
        subtitle="Resultaterne ruller ind. Korrekte tip giver point — du kan se status live."
      />

      <ul className="mt-6 lg:mt-10 space-y-3">
        {matches.map((match, idx) => {
          const revealed = idx < revealedCount
          const isCorrect = CORRECT_FLAGS[idx]

          return (
            <li
              key={`step3-${idx}`}
              className={
                'rounded-sm border transition-all duration-500 px-4 py-3 ' +
                (revealed
                  ? isCorrect
                    ? 'bg-gold/15 border-gold/40'
                    : 'border-cream/15 bg-transparent opacity-50'
                  : 'border-cream/10 bg-transparent opacity-50')
              }
            >
              <div className="flex items-center justify-between gap-3">
                <div className="font-body text-[14px] sm:text-[15px] text-cream/95 min-w-0 flex-1">
                  {match.derby && (
                    <div className="font-condensed text-[10px] uppercase tracking-[0.14em] text-gold/80 mb-1">
                      {match.derby}
                    </div>
                  )}
                  <div className="truncate">
                    {match.home} <span className="text-cream/50">—</span> {match.away}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {revealed && (
                    <div className="demo-result-reveal flex items-center gap-2">
                      {isCorrect ? (
                        <span className="text-green-500">
                          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </span>
                      ) : (
                        <span className="text-cream/40">
                          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M6 18L18 6" />
                          </svg>
                        </span>
                      )}
                      <span
                        className={
                          'font-condensed font-bold text-[12px] uppercase tracking-widest ' +
                          (isCorrect ? 'text-green-500' : 'text-cream/40')
                        }
                      >
                        {isCorrect ? '+3 PTS' : '0 PTS'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </li>
          )
        })}
      </ul>

      <div className="mt-10 text-center">
        <div className="font-display font-black text-gold text-[48px] lg:text-[64px] leading-none tabular-nums">
          {points} PTS
        </div>
        <div className="mt-3 font-body text-[14px] text-cream/70">
          {Math.min(revealedCount, 3)} af {matches.length} rigtige tip
        </div>
      </div>
    </>
  )
}

// ─── Step 4: Spilrummet ─────────────────────────────────────────────────────

function Step4({ onClose }: { onClose: () => void }) {
  return (
    <>
      <StepHeader
        tag="Trin 4 af 4"
        title="Spilrummet."
        subtitle="Sådan ser din liga ud efter en spilrunde. Point, rangering, og tråden hvor det hele foregår."
      />

      <div className="mt-6 lg:mt-10 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Leaderboard */}
        <div>
          <div className="font-condensed font-semibold text-[11px] uppercase tracking-widest text-gold mb-3">
            Rangliste · Runde 27
          </div>
          <div className="bg-forest/40 border border-gold/20 rounded-sm p-4 sm:p-5">
            <div className="grid grid-cols-[28px_1fr_60px_40px] gap-2 pb-2 border-b border-cream/10 font-condensed font-semibold text-[11px] uppercase tracking-widest text-cream/50">
              <span>#</span>
              <span>Spiller</span>
              <span className="text-right">Point</span>
              <span></span>
            </div>
            <ul>
              {LEADERBOARD.map((row) => (
                <li
                  key={row.pos}
                  className={
                    'grid grid-cols-[28px_1fr_60px_40px] gap-2 items-center py-2.5 border-b border-cream/10 last:border-b-0 text-[13px] ' +
                    (row.isUser ? 'bg-gold/10 border-l-2 border-l-gold pl-2 -ml-2' : '')
                  }
                >
                  <span
                    className="text-cream/60"
                    style={{ fontFamily: "'Courier New', monospace" }}
                  >
                    {row.pos}
                  </span>
                  <span
                    className={
                      'font-body truncate ' +
                      (row.isUser ? 'text-gold font-semibold' : 'text-cream/90')
                    }
                  >
                    {row.name}
                  </span>
                  <span
                    className="text-right text-cream/95 tabular-nums"
                    style={{ fontFamily: "'Courier New', monospace" }}
                  >
                    {row.pts} pts
                  </span>
                  <ChangeIndicator change={row.change} delta={row.delta} />
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Chat */}
        <div>
          <div className="font-condensed font-semibold text-[11px] uppercase tracking-widest text-gold mb-3">
            Tråden
          </div>
          <div className="bg-forest/40 border border-gold/20 rounded-sm p-4 sm:p-5 space-y-4">
            {CHAT_MESSAGES.map((msg) => (
              <div key={msg.name} className="flex items-start gap-3">
                <div
                  className={
                    'flex-shrink-0 rounded-full flex items-center justify-center font-condensed font-bold text-[12px] sm:text-[14px] w-8 h-8 sm:w-10 sm:h-10 ' +
                    msg.avatarBg
                  }
                  aria-hidden
                >
                  {msg.avatar}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="font-body font-semibold text-[13px] text-cream/95">
                      {msg.name}
                    </span>
                    <span
                      className="text-[11px] text-cream/40"
                      style={{ fontFamily: "'Courier New', monospace" }}
                    >
                      {msg.time}
                    </span>
                  </div>
                  <p className="mt-1 font-body text-[14px] text-cream/85 leading-relaxed break-words">
                    {msg.body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Final CTA — hidden on small (handled by sticky footer), shown on lg */}
      <div className="hidden lg:block mt-12">
        <div className="h-px bg-gold/30 mb-8" />
        <div className="text-center">
          <p className="font-display italic text-cream/95 text-[20px] lg:text-[22px]">
            Sådan kunne din liga se ud.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              href="/register"
              className="inline-flex items-center justify-center px-8 py-4 bg-gold text-forest font-condensed font-bold text-[13px] uppercase tracking-widest rounded-sm hover:opacity-90 transition-opacity"
            >
              Start din egen liga →
            </Link>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center px-8 py-4 bg-transparent border border-cream/40 text-cream font-condensed font-bold text-[13px] uppercase tracking-widest rounded-sm hover:border-cream/70 transition-colors"
            >
              Luk demo
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

// ─── Shared components ──────────────────────────────────────────────────────

function StepHeader({
  tag,
  title,
  subtitle,
}: {
  tag: string
  title: string
  subtitle: string
}) {
  return (
    <div className="mt-2">
      <span className="font-condensed font-semibold text-[11px] uppercase tracking-widest text-gold">
        {tag}
      </span>
      <h2
        id="demo-step-heading"
        className="mt-2 font-display font-black text-cream text-[28px] lg:text-[36px] leading-tight"
      >
        {title}
      </h2>
      <p className="mt-3 font-body text-[14px] lg:text-[16px] text-cream/75 leading-relaxed max-w-[520px]">
        {subtitle}
      </p>
    </div>
  )
}

function ChangeIndicator({
  change,
  delta,
}: {
  change: LeaderRow['change']
  delta?: number
}) {
  const arrowClass = 'font-mono text-[12px] tabular-nums text-right'
  const fontFamily = "'Courier New', monospace"

  if (change === 'new') {
    return (
      <span
        className="font-condensed font-bold text-[10px] uppercase tracking-widest text-gold text-right"
      >
        NY
      </span>
    )
  }
  if (change === 'up') {
    return (
      <span className={arrowClass + ' text-green-500'} style={{ fontFamily }}>
        ↑{delta ?? ''}
      </span>
    )
  }
  if (change === 'down') {
    return (
      <span className={arrowClass + ' text-vintage-red'} style={{ fontFamily }}>
        ↓{delta ?? ''}
      </span>
    )
  }
  return (
    <span className={arrowClass + ' text-cream/50'} style={{ fontFamily }}>
      →
    </span>
  )
}

function FooterNav({
  step,
  canAdvance,
  onBack,
  onNext,
  onClose,
}: {
  step: 1 | 2 | 3 | 4
  canAdvance: boolean
  onBack: () => void
  onNext: () => void
  onClose: () => void
}) {
  const isLast = step === 4
  const showBack = step > 1 && step <= 3
  const nextLabel =
    step === 1 ? 'Næste →' : step === 2 ? 'Næste →' : 'Se spilrummet →'

  return (
    <div
      className="flex-shrink-0 border-t border-cream/10 bg-forest/95 backdrop-blur-md"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4">
        {isLast ? (
          // Step 4 — primary + secondary CTA, stacks on mobile
          <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-center">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-4 bg-transparent border border-cream/40 text-cream font-condensed font-bold text-[13px] uppercase tracking-widest rounded-sm hover:border-cream/70 transition-colors min-h-[52px]"
            >
              Luk demo
            </button>
            <Link
              href="/register"
              className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-4 bg-gold text-forest font-condensed font-bold text-[13px] uppercase tracking-widest rounded-sm hover:opacity-90 transition-opacity min-h-[52px]"
            >
              Start din egen liga →
            </Link>
          </div>
        ) : (
          // Steps 1-3 — back + next, stacks reverse on mobile (next on top)
          <div className="flex flex-col-reverse sm:flex-row sm:justify-between gap-3">
            {showBack ? (
              <button
                type="button"
                onClick={onBack}
                className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-4 bg-transparent text-cream/70 hover:text-cream font-condensed font-bold text-[13px] uppercase tracking-widest rounded-sm transition-colors min-h-[52px]"
              >
                ← Tilbage
              </button>
            ) : (
              <span className="hidden sm:block" />
            )}

            <button
              type="button"
              onClick={onNext}
              disabled={!canAdvance}
              className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-4 bg-gold text-forest font-condensed font-bold text-[13px] uppercase tracking-widest rounded-sm hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed min-h-[52px]"
            >
              {nextLabel}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Animations ─────────────────────────────────────────────────────────────

function DemoStyles({ reducedMotion }: { reducedMotion: boolean }) {
  if (reducedMotion) {
    return (
      <style>{`
        .demo-modal-entering, .demo-modal-exiting,
        .demo-step-anim, .demo-result-reveal { animation: none !important; }
      `}</style>
    )
  }
  return (
    <style>{`
      @keyframes demoModalIn {
        from { opacity: 0; transform: scale(0.96); }
        to   { opacity: 1; transform: scale(1); }
      }
      @keyframes demoModalOut {
        from { opacity: 1; transform: scale(1); }
        to   { opacity: 0; transform: scale(0.98); }
      }
      @keyframes demoStepIn {
        from { opacity: 0; transform: translateY(8px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      @keyframes demoResultIn {
        from { opacity: 0; transform: scale(0.92); }
        to   { opacity: 1; transform: scale(1); }
      }
      .demo-modal-entering { animation: demoModalIn 250ms ease-out both; }
      .demo-modal-exiting  { animation: demoModalOut 200ms ease-in both; }
      .demo-step-anim       { animation: demoStepIn 200ms ease-out both; }
      .demo-result-reveal   { animation: demoResultIn 400ms ease-out both; }
    `}</style>
  )
}
