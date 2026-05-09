'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

// ─── Data ───────────────────────────────────────────────────────────────────

type LeagueId = 'pl' | 'la-liga' | 'serie-a' | 'bodega'
type Tip = '1' | 'X' | '2'

type Match = {
  home: string
  away: string
  homeShort: string
  awayShort: string
  homeLogo: string
  awayLogo: string
  kickoff: string
  derby?: string // for Bodega Championship rivalries
  multiplier?: string // e.g. "1.5×"
}

// Same CDN som produktet bruger (bold.dk).
const LOGO = (id: number) => `https://bold.dk/img/tag/64x64/${id}.png`
const LOGOS = {
  liverpool: LOGO(175),
  arsenal: LOGO(9),
  manUtd: LOGO(71),
  chelsea: LOGO(27),
  tottenham: LOGO(118),
  newcastle: LOGO(176),
  villa: LOGO(10),
  brighton: LOGO(185),
  realMadrid: LOGO(96),
  atletico: LOGO(7416),
  barcelona: LOGO(2),
  sevilla: LOGO(212),
  valencia: LOGO(217),
  villarreal: LOGO(3613),
  sociedad: LOGO(98),
  bilbao: LOGO(12),
  inter: LOGO(60),
  juventus: LOGO(7763),
  milan: LOGO(72),
  roma: LOGO(153),
  napoli: LOGO(226),
  lazio: LOGO(64),
  fiorentina: LOGO(224),
  bologna: LOGO(8184),
  manCity: LOGO(5347),
  dortmund: LOGO(161),
  bayern: LOGO(16),
} as const

type League = {
  id: LeagueId
  name: string
  description: string
  isFlagship?: boolean
}

const LEAGUES: readonly League[] = [
  { id: 'pl', name: 'Premier League', description: 'Engelsk topfodbold. 20 hold, 38 spillerunder.' },
  { id: 'la-liga', name: 'La Liga', description: 'Spansk topfodbold. El Clásico, Sevilla-derby og mere.' },
  { id: 'serie-a', name: 'Serie A', description: "Italiensk topfodbold. Derby della Madonnina, Derby d'Italia." },
  {
    id: 'bodega',
    name: 'Bodega Championship',
    description: 'Du følger ikke én liga — du følger Europa.',
    isFlagship: true,
  },
] as const

const MATCHES: Record<LeagueId, readonly Match[]> = {
  pl: [
    { home: 'Liverpool', away: 'Arsenal', homeShort: 'Liverpool', awayShort: 'Arsenal', homeLogo: LOGOS.liverpool, awayLogo: LOGOS.arsenal, kickoff: 'Lør 17:30' },
    { home: 'Manchester United', away: 'Chelsea', homeShort: 'Man Utd', awayShort: 'Chelsea', homeLogo: LOGOS.manUtd, awayLogo: LOGOS.chelsea, kickoff: 'Søn 14:00' },
    { home: 'Tottenham', away: 'Newcastle', homeShort: 'Tottenham', awayShort: 'Newcastle', homeLogo: LOGOS.tottenham, awayLogo: LOGOS.newcastle, kickoff: 'Søn 16:30' },
    { home: 'Aston Villa', away: 'Brighton', homeShort: 'Villa', awayShort: 'Brighton', homeLogo: LOGOS.villa, awayLogo: LOGOS.brighton, kickoff: 'Man 21:00' },
  ],
  'la-liga': [
    { home: 'Real Madrid', away: 'Atlético', homeShort: 'Real Madrid', awayShort: 'Atlético', homeLogo: LOGOS.realMadrid, awayLogo: LOGOS.atletico, kickoff: 'Lør 21:00' },
    { home: 'Barcelona', away: 'Sevilla', homeShort: 'Barcelona', awayShort: 'Sevilla', homeLogo: LOGOS.barcelona, awayLogo: LOGOS.sevilla, kickoff: 'Søn 18:30' },
    { home: 'Valencia', away: 'Villarreal', homeShort: 'Valencia', awayShort: 'Villarreal', homeLogo: LOGOS.valencia, awayLogo: LOGOS.villarreal, kickoff: 'Søn 16:15' },
    { home: 'Real Sociedad', away: 'Athletic Bilbao', homeShort: 'R. Sociedad', awayShort: 'A. Bilbao', homeLogo: LOGOS.sociedad, awayLogo: LOGOS.bilbao, kickoff: 'Man 21:00' },
  ],
  'serie-a': [
    { home: 'Inter', away: 'Juventus', homeShort: 'Inter', awayShort: 'Juventus', homeLogo: LOGOS.inter, awayLogo: LOGOS.juventus, kickoff: 'Lør 20:45' },
    { home: 'AC Milan', away: 'Roma', homeShort: 'Milan', awayShort: 'Roma', homeLogo: LOGOS.milan, awayLogo: LOGOS.roma, kickoff: 'Søn 18:00' },
    { home: 'Napoli', away: 'Lazio', homeShort: 'Napoli', awayShort: 'Lazio', homeLogo: LOGOS.napoli, awayLogo: LOGOS.lazio, kickoff: 'Søn 20:45' },
    { home: 'Fiorentina', away: 'Bologna', homeShort: 'Fiorentina', awayShort: 'Bologna', homeLogo: LOGOS.fiorentina, awayLogo: LOGOS.bologna, kickoff: 'Man 20:45' },
  ],
  bodega: [
    { home: 'Real Madrid', away: 'Barcelona', homeShort: 'Real Madrid', awayShort: 'Barcelona', homeLogo: LOGOS.realMadrid, awayLogo: LOGOS.barcelona, kickoff: 'Lør 21:00', derby: 'El Clásico', multiplier: '1.5×' },
    { home: 'Manchester Utd', away: 'Manchester City', homeShort: 'Man Utd', awayShort: 'Man City', homeLogo: LOGOS.manUtd, awayLogo: LOGOS.manCity, kickoff: 'Søn 17:30', derby: 'Manchester Derby', multiplier: '1.3×' },
    { home: 'Dortmund', away: 'Bayern', homeShort: 'Dortmund', awayShort: 'Bayern', homeLogo: LOGOS.dortmund, awayLogo: LOGOS.bayern, kickoff: 'Lør 18:30', derby: 'Der Klassiker', multiplier: '1.4×' },
    { home: 'Inter', away: 'Milan', homeShort: 'Inter', awayShort: 'Milan', homeLogo: LOGOS.inter, awayLogo: LOGOS.milan, kickoff: 'Søn 20:45', derby: 'Derby della Madonnina', multiplier: '1.4×' },
  ],
} as const

// 3 first matches "correct", last "incorrect" — uanset user's faktiske tips.
const CORRECT_FLAGS: readonly boolean[] = [true, true, true, false]

// Realistisk fordeling per kamp i step 3 — odds + % af spillere der har valgt
// hvert outcome. Højeste % vises i guld (matcher produktets bet-distribution).
type Distribution = {
  '1': { odds: number; pct: number }
  X: { odds: number; pct: number }
  '2': { odds: number; pct: number }
}
const MATCH_DISTRIBUTIONS: readonly Distribution[] = [
  { '1': { odds: 1.85, pct: 58 }, X: { odds: 3.6, pct: 22 }, '2': { odds: 4.2, pct: 20 } },
  { '1': { odds: 2.1, pct: 47 }, X: { odds: 3.3, pct: 30 }, '2': { odds: 3.4, pct: 23 } },
  { '1': { odds: 2.5, pct: 38 }, X: { odds: 3.1, pct: 35 }, '2': { odds: 2.7, pct: 27 } },
  { '1': { odds: 2.9, pct: 33 }, X: { odds: 3.2, pct: 25 }, '2': { odds: 2.4, pct: 42 } },
] as const

// Credits-system — bruger har 500 at fordele over 4 kampe.
const TOTAL_BUDGET = 500
const DEFAULT_STAKE = 100
const STAKE_STEP = 50
const MIN_STAKE = 50

// "Correct" outcome per match index — bruges til at vise resultat-tegnet
const CORRECT_OUTCOMES: readonly Tip[] = ['1', '1', 'X', '1']
// Faked scores i step 3 så det ligner finished matches i AfgivBets
const FAKE_SCORES: readonly { home: number; away: number }[] = [
  { home: 2, away: 0 },
  { home: 3, away: 1 },
  { home: 1, away: 1 },
  { home: 0, away: 2 },
]

type LeaderRow = {
  pos: number
  name: string
  roundWins: number
  roundPoints: number
  blockWins: number
  blockPoints: number
  isUser?: boolean
}

const LEADERBOARD: readonly LeaderRow[] = [
  { pos: 1, name: 'Zidane', roundWins: 3, roundPoints: 14, blockWins: 2, blockPoints: 47 },
  { pos: 2, name: 'Dig', roundWins: 2, roundPoints: 9, blockWins: 1, blockPoints: 43, isUser: true },
  { pos: 3, name: 'Beckham', roundWins: 1, roundPoints: 7, blockWins: 1, blockPoints: 39 },
  { pos: 4, name: 'Maldini', roundWins: 1, roundPoints: 6, blockWins: 0, blockPoints: 38 },
  { pos: 5, name: 'Henry', roundWins: 0, roundPoints: 5, blockWins: 0, blockPoints: 35 },
  { pos: 6, name: 'Ronaldinho', roundWins: 0, roundPoints: 3, blockWins: 0, blockPoints: 28 },
] as const

const CHAT_MESSAGES = [
  { avatar: 'Z', avatarBg: '#B8963E', avatarFg: '#F2EDE4', name: 'Zidane', time: 'for 12 min siden', body: 'haha Beckham tippede igen Spurs hjemme 😅' },
  { avatar: 'B', avatarBg: '#2C4A3E', avatarFg: '#F2EDE4', name: 'Beckham', time: 'for 8 min siden', body: 'hold kæft jeg holder fast i mit system' },
] as const

// ─── Component ──────────────────────────────────────────────────────────────

type Props = { open: boolean; onClose: () => void }

export default function DemoModal({ open, onClose }: Props) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
  const [selectedLeague, setSelectedLeague] = useState<LeagueId | null>(null)
  const [tips, setTips] = useState<Record<number, Tip>>({})
  const [stakes, setStakes] = useState<Record<number, number>>({})
  const [reducedMotion, setReducedMotion] = useState(false)
  const [exiting, setExiting] = useState(false)
  const [mounted, setMounted] = useState(false)

  const closeBtnRef = useRef<HTMLButtonElement | null>(null)
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const previousActiveRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    setReducedMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  }, [])

  useEffect(() => {
    if (open) {
      setMounted(true)
      setExiting(false)
    } else if (mounted) {
      setExiting(true)
      const t = window.setTimeout(() => {
        setMounted(false)
        setExiting(false)
        setStep(1)
        setSelectedLeague(null)
        setTips({})
        setStakes({})
      }, reducedMotion ? 0 : 200)
      return () => window.clearTimeout(t)
    }
  }, [open, mounted, reducedMotion])

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
        if (!dialogRef.current) return
        const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
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
    const focusTimer = window.setTimeout(() => closeBtnRef.current?.focus(), reducedMotion ? 0 : 50)

    return () => {
      document.body.style.overflow = original
      document.removeEventListener('keydown', handleKey)
      window.clearTimeout(focusTimer)
      if (previousActiveRef.current?.focus) previousActiveRef.current.focus()
    }
  }, [mounted, onClose, reducedMotion])

  if (!mounted) return null

  const currentLeagueMatches = selectedLeague ? MATCHES[selectedLeague] : []
  const tipsCount = Object.keys(tips).length
  const currentLeague = selectedLeague ? LEAGUES.find((l) => l.id === selectedLeague)! : null

  function selectLeague(id: LeagueId) {
    setSelectedLeague(id)
    setTips({})
    setStakes({})
  }
  function setTip(idx: number, t: Tip) {
    // Hvis brugeren klikker samme tip igen → fjern det (toggle off)
    setTips((prev) => {
      if (prev[idx] === t) {
        const next = { ...prev }
        delete next[idx]
        return next
      }
      return { ...prev, [idx]: t }
    })
    // Tildel default-stake (100) første gang en match får et tip
    setStakes((prev) => (prev[idx] !== undefined ? prev : { ...prev, [idx]: DEFAULT_STAKE }))
  }
  function removeTip(idx: number) {
    setTips((prev) => {
      const next = { ...prev }
      delete next[idx]
      return next
    })
    setStakes((prev) => {
      const next = { ...prev }
      delete next[idx]
      return next
    })
  }
  function adjustStake(idx: number, delta: number) {
    setStakes((prev) => {
      const current = prev[idx] ?? DEFAULT_STAKE
      const otherUsed = Object.entries(prev).reduce(
        (sum, [k, v]) => (Number(k) === idx ? sum : sum + v),
        0,
      )
      const remainingForThis = TOTAL_BUDGET - otherUsed
      const next = Math.max(MIN_STAKE, Math.min(remainingForThis, current + delta))
      return { ...prev, [idx]: next }
    })
  }

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="demo-step-heading"
      className={`fixed inset-0 z-[100] flex items-stretch sm:items-center sm:justify-center bg-forest/80 backdrop-blur-md ${
        exiting ? 'demo-modal-exiting' : 'demo-modal-entering'
      }`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <DemoStyles reducedMotion={reducedMotion} />

      {/* Modal content frame — full-screen on mobile, contained on sm+ */}
      <div
        className="relative bg-cream w-full sm:max-w-3xl sm:max-h-[92vh] sm:rounded-sm flex flex-col overflow-hidden"
        style={{ fontFamily: "'Barlow', sans-serif" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 flex-shrink-0 border-b border-warm-border bg-cream">
          <button
            type="button"
            onClick={() => setStep(4)}
            className="font-condensed font-semibold text-[11px] sm:text-[12px] uppercase tracking-widest text-gold-dark hover:text-forest transition-colors min-h-[44px] inline-flex items-center"
          >
            Spring til slutningen →
          </button>

          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            aria-label="Luk demo"
            className="w-11 h-11 inline-flex items-center justify-center rounded-sm text-warm-gray hover:text-ink hover:bg-warm-border/40 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" d="M6 6l12 12M6 18L18 6" />
            </svg>
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 py-3 flex-shrink-0 bg-cream">
          {[1, 2, 3, 4].map((n) => (
            <span
              key={n}
              aria-hidden
              className={
                'rounded-full transition-all duration-300 ' +
                (n === step ? 'w-2.5 h-2.5 bg-gold-dark' : 'w-1.5 h-1.5 bg-warm-border')
              }
            />
          ))}
        </div>

        {/* Step content — scrollable */}
        <div className="flex-1 overflow-y-auto overscroll-contain bg-cream">
          <div key={step} className="demo-step-anim" aria-live="polite">
            {step === 1 && <Step1 selectedLeague={selectedLeague} onSelect={selectLeague} />}
            {step === 2 && currentLeague && (
              <Step2
                league={currentLeague}
                matches={currentLeagueMatches}
                tips={tips}
                stakes={stakes}
                onTip={setTip}
                onRemoveTip={removeTip}
                onAdjustStake={adjustStake}
              />
            )}
            {step === 3 && currentLeague && (
              <Step3
                league={currentLeague}
                matches={currentLeagueMatches}
                tips={tips}
                stakes={stakes}
                reducedMotion={reducedMotion}
              />
            )}
            {step === 4 && currentLeague && <Step4 league={currentLeague} onClose={onClose} />}
            {step === 4 && !currentLeague && (
              // Skip-link case: ingen liga valgt — vis Bodega som default
              <Step4 league={LEAGUES[3]} onClose={onClose} />
            )}
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
    <div className="px-4 sm:px-6 pt-4 pb-8">
      <StepHeader
        tag="Trin 1 af 4"
        title="Vælg din liga."
        subtitle="Spil på din yndlingsliga, eller lad Bodega Championship samle ugens største kampe fra hele Europa."
      />

      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-6 auto-rows-fr">
        {LEAGUES.map((league) => {
          const isSelected = selectedLeague === league.id
          return (
            <li key={league.id} className="h-full">
              <button
                type="button"
                onClick={() => onSelect(league.id)}
                aria-pressed={isSelected}
                className={
                  'w-full h-full text-left p-4 sm:p-5 rounded-sm transition-colors min-h-[88px] relative bg-white ' +
                  (isSelected
                    ? 'border-2 border-forest shadow-[0_0_0_1px_#1a3329] '
                    : league.isFlagship
                      ? 'border-2 border-gold-dark/60 hover:border-gold-dark '
                      : 'border border-warm-border hover:border-forest ')
                }
              >
                {league.isFlagship && (
                  <span className="absolute top-3 right-3 font-condensed font-bold text-[9px] uppercase tracking-[0.12em] text-gold-dark">
                    Vores format
                  </span>
                )}
                <div className="font-condensed font-bold text-forest text-[18px] sm:text-[20px] leading-tight pr-20">
                  {league.name}
                </div>
                <div className="mt-2 font-body text-[13px] text-warm-gray leading-relaxed">
                  {league.description}
                </div>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// ─── Step 2: Tip ugens kampe ────────────────────────────────────────────────

function Step2({
  league,
  matches,
  tips,
  stakes,
  onTip,
  onRemoveTip,
  onAdjustStake,
}: {
  league: League
  matches: readonly Match[]
  tips: Record<number, Tip>
  stakes: Record<number, number>
  onTip: (idx: number, t: Tip) => void
  onRemoveTip: (idx: number) => void
  onAdjustStake: (idx: number, delta: number) => void
}) {
  const used = Object.values(stakes).reduce((sum, s) => sum + s, 0)
  const remaining = TOTAL_BUDGET - used

  return (
    <div className="px-4 sm:px-6 pt-3 pb-6">
      {/* Kompakt header — kun tag + title, ingen subtitle */}
      <div>
        <span className="font-condensed font-bold text-[11px] uppercase tracking-[0.14em] text-gold-dark">
          Trin 2 af 4
        </span>
        <h2
          id="demo-step-heading"
          className="mt-1 font-display font-black text-forest text-[24px] sm:text-[30px] leading-tight"
        >
          Tip ugens kampe.
        </h2>
      </div>

      {/* Liga-strip */}
      <div className="mt-3 inline-flex items-center gap-2 px-2.5 py-1 bg-forest text-cream rounded-sm">
        <span className="font-condensed font-bold text-[10px] uppercase tracking-[0.12em]">
          {league.name} · Runde 27
        </span>
      </div>

      <div className="mt-3 grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-3">
        {/* Match cards — ingen stake-row, lever i kuponen */}
        <div className="space-y-1.5">
          {matches.map((match, idx) => (
            <MatchCard
              key={`${league.id}-${idx}`}
              match={match}
              selected={tips[idx]}
              mode="open"
              onTip={(t) => onTip(idx, t)}
              compact
            />
          ))}
        </div>

        {/* Kupon panel — sticky til højre på lg, naturligt under på mobil */}
        <div className="lg:sticky lg:top-2 self-start">
          <KuponPanel
            matches={matches}
            tips={tips}
            stakes={stakes}
            used={used}
            remaining={remaining}
            onAdjustStake={onAdjustStake}
            onRemoveTip={onRemoveTip}
          />
        </div>
      </div>
    </div>
  )
}

// ─── Kupon panel — mirror af AfgivBets sidebar ─────────────────────────────

function KuponPanel({
  matches,
  tips,
  stakes,
  used,
  remaining,
  onAdjustStake,
  onRemoveTip,
}: {
  matches: readonly Match[]
  tips: Record<number, Tip>
  stakes: Record<number, number>
  used: number
  remaining: number
  onAdjustStake: (idx: number, delta: number) => void
  onRemoveTip: (idx: number) => void
}) {
  const entries = Object.keys(tips)
    .map((k) => Number(k))
    .sort((a, b) => a - b)
    .map((idx) => ({ idx, tip: tips[idx], stake: stakes[idx] ?? DEFAULT_STAKE, match: matches[idx] }))

  const overBudget = remaining < 0

  return (
    <div className="bg-white border border-warm-border rounded-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-warm-border">
        <span className="font-condensed font-bold text-[11px] uppercase tracking-[0.14em] text-forest">
          Din kupon
        </span>
        <span
          className="font-condensed font-bold text-[18px] text-gold-dark leading-none tabular-nums"
          style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
        >
          {entries.length}
        </span>
      </div>

      {/* Credits bar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-warm-border bg-cream">
        <span className="font-condensed font-bold text-[9px] uppercase tracking-[0.14em] text-warm-taupe">
          Credits tilbage
        </span>
        <span
          className={
            'font-condensed font-bold text-[16px] leading-none tabular-nums ' +
            (overBudget ? 'text-vintage-red' : 'text-forest')
          }
          style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
        >
          {remaining} pt
        </span>
      </div>

      {/* Selections list */}
      <div className="divide-y divide-warm-border max-h-[360px] overflow-y-auto">
        {entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 px-4 text-center text-warm-taupe gap-1.5">
            <span className="text-2xl opacity-30" aria-hidden>🎯</span>
            <p className="text-[12px] leading-relaxed">
              Vælg et udfald
              <br />
              for at tilføje til kuponen
            </p>
          </div>
        ) : (
          entries.map(({ idx, tip, stake, match }) => (
            <div key={idx} className="px-3 py-2">
              {/* Match + outcome + remove */}
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="text-[11px] font-semibold flex-1 truncate text-forest">
                  {match.homeShort} vs {match.awayShort}
                </span>
                <span className="font-condensed text-[12px] font-bold text-forest bg-gold/15 rounded px-1.5 leading-tight py-0.5">
                  {tip}
                </span>
                <button
                  type="button"
                  onClick={() => onRemoveTip(idx)}
                  aria-label="Fjern valg"
                  className="text-[12px] text-warm-taupe opacity-50 hover:opacity-100 hover:text-vintage-red w-5 h-5 inline-flex items-center justify-center"
                >
                  ✕
                </button>
              </div>
              {/* Stake controls */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onAdjustStake(idx, -STAKE_STEP)}
                  disabled={stake <= MIN_STAKE}
                  aria-label="Mindre stake"
                  className="w-6 h-6 border border-warm-border rounded bg-cream text-forest font-bold text-sm flex items-center justify-center disabled:opacity-30 hover:border-forest"
                >
                  −
                </button>
                <div className="flex-1 text-center font-condensed text-[14px] font-bold text-forest border border-warm-border rounded bg-cream h-6 leading-6 tabular-nums">
                  {stake}
                </div>
                <span className="text-[10px] text-warm-taupe font-semibold">pt</span>
                <button
                  type="button"
                  onClick={() => onAdjustStake(idx, STAKE_STEP)}
                  disabled={remaining < STAKE_STEP}
                  aria-label="Større stake"
                  className="w-6 h-6 border border-warm-border rounded bg-cream text-forest font-bold text-sm flex items-center justify-center disabled:opacity-30 hover:border-forest"
                >
                  +
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-warm-border px-3 py-2.5 bg-white">
        <div className="flex items-center justify-between mb-0.5">
          <span className="text-[10px] text-warm-taupe font-semibold uppercase tracking-wider">
            Antal valg
          </span>
          <span
            className="font-condensed text-[14px] font-bold text-forest tabular-nums"
            style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
          >
            {entries.length} / {matches.length}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-warm-taupe font-semibold uppercase tracking-wider">
            Samlet stake
          </span>
          <span
            className="font-condensed text-[14px] font-bold text-gold-dark tabular-nums"
            style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
          >
            {used} / {TOTAL_BUDGET} pt
          </span>
        </div>
      </div>
    </div>
  )
}

// ─── Step 3: Kickoff. Point i realtid. ──────────────────────────────────────

function Step3({
  league,
  matches,
  tips,
  stakes,
  reducedMotion,
}: {
  league: League
  matches: readonly Match[]
  tips: Record<number, Tip>
  stakes: Record<number, number>
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
      timeouts.push(window.setTimeout(() => setRevealedCount(i + 1), 800 + i * 600))
    }
    return () => timeouts.forEach((t) => window.clearTimeout(t))
  }, [matches.length, reducedMotion])

  // Points: korrekt → +stake, forkert → −stake (real betting-mekanik)
  let points = 0
  for (let i = 0; i < revealedCount; i++) {
    const stake = stakes[i] ?? DEFAULT_STAKE
    points += CORRECT_FLAGS[i] ? stake : -stake
  }
  const correctCount = Math.min(revealedCount, 3)

  return (
    <div className="px-4 sm:px-6 pt-4 pb-8">
      <StepHeader
        tag="Trin 3 af 4"
        title="Kickoff. Point i realtid."
        subtitle="Resultaterne ruller ind. Korrekt tip = stake tilbage som point. Forkert = stake tabt."
      />

      {/* Round panel — mirror af LiveMatchesTicker / faktisk gameroom-runde */}
      <div className="mt-5 bg-forest text-cream rounded-sm overflow-hidden">
        <div className="px-4 py-2.5 flex items-center justify-between border-b border-cream/10">
          <span className="font-condensed font-bold text-[12px] uppercase tracking-[0.12em]">
            Runde 27 · {league.name}
          </span>
          <span
            className="text-[10px] text-cream/40"
            style={{ fontFamily: "'Courier New', monospace" }}
          >
            Live · 21:48
          </span>
        </div>

        {/* Date separator */}
        <div className="flex items-center gap-2 px-3 py-1.5">
          <div className="flex-1 h-px bg-cream/10" />
          <span className="font-condensed text-[10px] font-bold text-cream/55 uppercase tracking-wider">
            Lørdag 9. maj
          </span>
          <div className="flex-1 h-px bg-cream/10" />
        </div>

        {/* Match rows */}
        {matches.map((match, idx) => (
          <ResultRow
            key={`step3-${idx}`}
            match={match}
            revealed={idx < revealedCount}
            score={FAKE_SCORES[idx]}
            userPick={tips[idx] ?? null}
            correctOutcome={CORRECT_OUTCOMES[idx]}
            isCorrect={CORRECT_FLAGS[idx]}
            stake={stakes[idx] ?? DEFAULT_STAKE}
            distribution={MATCH_DISTRIBUTIONS[idx]}
            isLast={idx === matches.length - 1}
          />
        ))}
      </div>

      <div className="mt-8 text-center">
        <div
          className={
            'font-condensed font-bold text-[44px] sm:text-[64px] leading-none tabular-nums ' +
            (points >= 0 ? 'text-gold-dark' : 'text-vintage-red')
          }
        >
          {points >= 0 ? '+' : ''}
          {points}{' '}
          <span className="text-[20px] sm:text-[24px] font-condensed">PTS</span>
        </div>
        <div className="mt-2 font-body text-[13px] sm:text-[14px] text-warm-gray">
          {correctCount} af {matches.length} rigtige tip
        </div>
      </div>
    </div>
  )
}

// ─── ResultRow — kompakt runde-række mirror af LiveMatchesTicker ───────────

function ResultRow({
  match,
  revealed,
  score,
  userPick,
  correctOutcome,
  isCorrect,
  stake,
  distribution,
  isLast,
}: {
  match: Match
  revealed: boolean
  score: { home: number; away: number }
  userPick: Tip | null
  correctOutcome: Tip
  isCorrect: boolean
  stake: number
  distribution: Distribution
  isLast: boolean
}) {
  const isRivalry = !!match.derby
  const maxPct = Math.max(distribution['1'].pct, distribution.X.pct, distribution['2'].pct)

  return (
    <div
      className={
        (isLast ? '' : 'border-b border-cream/[0.06] ') +
        (isRivalry ? 'bg-forest-light/30 ' : '')
      }
      style={{ fontFamily: "'Barlow', sans-serif" }}
    >
      {/* Rivalry tag */}
      {isRivalry && (
        <div className="flex items-center gap-1.5 px-3 pt-1.5 pb-0">
          <span className="text-[10px]" aria-hidden>🔥</span>
          <span
            className="font-condensed text-[10px] font-bold uppercase tracking-widest"
            style={{ color: '#B8963E' }}
          >
            {match.derby} {match.multiplier && `· ${match.multiplier}`}
          </span>
        </div>
      )}

      {/* Main row: home — score — away — status/result */}
      <div className="flex items-center gap-2 px-3 py-1.5">
        {/* Home */}
        <div className="flex items-center gap-1.5 flex-1 min-w-0 justify-end">
          <span className="font-condensed font-semibold text-[13px] text-cream truncate">
            {match.homeShort}
          </span>
          <img
            src={match.homeLogo}
            alt=""
            style={{ width: 18, height: 18, objectFit: 'contain' }}
            className="shrink-0"
            loading="lazy"
          />
        </div>

        {/* Score / vs */}
        <div className="shrink-0 w-11 text-center">
          {revealed ? (
            <span className="font-condensed font-black text-[13px] tabular-nums text-cream">
              {score.home}–{score.away}
            </span>
          ) : (
            <span className="text-[10px] text-cream/40 font-semibold">vs</span>
          )}
        </div>

        {/* Away */}
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <img
            src={match.awayLogo}
            alt=""
            style={{ width: 18, height: 18, objectFit: 'contain' }}
            className="shrink-0"
            loading="lazy"
          />
          <span className="font-condensed font-semibold text-[13px] text-cream truncate">
            {match.awayShort}
          </span>
        </div>

        {/* Result pill (replaces 'SLUT' — score communicates that) */}
        {revealed ? (
          <span
            className={
              'shrink-0 font-condensed text-[12px] font-bold tabular-nums tracking-wider ' +
              (isCorrect ? 'text-gold-dark' : 'text-vintage-red')
            }
            style={{ minWidth: '54px', textAlign: 'right' }}
          >
            {isCorrect ? '+' : '−'}
            {stake} pt
          </span>
        ) : (
          <span
            className="shrink-0 font-condensed text-[10px] font-bold uppercase tracking-wider text-gold-dark"
            style={{ minWidth: '54px', textAlign: 'right' }}
          >
            Live
          </span>
        )}
      </div>

      {/* Distribution + dit valg — én kompakt vandret række */}
      {revealed && (
        <div className="flex items-center gap-3 px-3 pb-1.5 border-t border-cream/[0.06] pt-1.5 demo-result-reveal">
          <div className="flex items-center gap-3 flex-1 justify-center">
            {(['1', 'X', '2'] as const).map((opt) => {
              const data = distribution[opt]
              const isHighest = data.pct === maxPct && data.pct > 0
              const isUserPick = userPick === opt
              const isCorrectOutcome = correctOutcome === opt
              const valueColor = isUserPick
                ? isCorrect
                  ? 'text-gold'
                  : 'text-vintage-red'
                : isCorrectOutcome
                  ? 'text-gold/80'
                  : isHighest
                    ? 'text-gold/60'
                    : 'text-cream/50'
              return (
                <div
                  key={opt}
                  className={
                    'flex items-baseline gap-1.5 ' +
                    (isUserPick ? 'rounded px-1.5 py-0.5 bg-cream/[0.06]' : '')
                  }
                >
                  <span className="font-condensed font-bold text-[10px] uppercase text-cream/40">
                    {opt}
                  </span>
                  <span
                    className="font-condensed text-[10px] tabular-nums text-cream/40"
                    style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
                  >
                    {data.odds.toFixed(2)}
                  </span>
                  <span
                    className={'font-condensed text-[12px] font-bold tabular-nums ' + valueColor}
                    style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
                  >
                    {data.pct}%
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Step 4: Spilrummet ─────────────────────────────────────────────────────

function Step4({ league, onClose }: { league: League; onClose: () => void }) {
  return (
    <>
      {/* Hero strip — mirrors gameroom */}
      <div
        className="px-5 pt-6 pb-7 text-cream"
        style={{ background: '#1a3329', fontFamily: "'Barlow', sans-serif" }}
      >
        <div className="max-w-[680px] mx-auto">
          <div className="flex items-start justify-between gap-3 mb-5">
            <div className="min-w-0 flex-1">
              <h1
                id="demo-step-heading"
                className="font-condensed font-bold leading-tight"
                style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 24, letterSpacing: '-0.01em' }}
              >
                {league.name} 25/26
              </h1>
              <span
                className="inline-block mt-1.5 px-2 py-0.5 rounded-sm border"
                style={{
                  background: 'rgba(242,237,228,0.15)',
                  borderColor: 'rgba(242,237,228,0.3)',
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontSize: 10,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                }}
              >
                Aktiv
              </span>
            </div>
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-sm flex-shrink-0"
              style={{ background: 'rgba(242,237,228,0.1)', border: '1px solid rgba(242,237,228,0.2)' }}
            >
              <span
                style={{
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontSize: 9,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: 'rgba(242,237,228,0.6)',
                }}
              >
                Invitér
              </span>
              <span
                style={{
                  fontFamily: "'Courier New', monospace",
                  fontSize: 13,
                  fontWeight: 700,
                  color: '#B8963E',
                  letterSpacing: '0.08em',
                }}
              >
                BDG-7K2A
              </span>
            </div>
          </div>

          {/* Stats strip — matches gameroom 4-col grid */}
          <div
            className="grid grid-cols-4 pt-3.5"
            style={{ borderTop: '1px solid rgba(242,237,228,0.15)' }}
          >
            {[
              { label: 'Deltagere', value: '6', gold: false },
              { label: 'Runder', value: '27', gold: false },
              { label: 'Placering', value: '#2', gold: false },
              { label: 'Dine point', value: '43', gold: true },
            ].map((stat, i) => (
              <div
                key={stat.label}
                style={{
                  paddingLeft: i > 0 ? 10 : 0,
                  paddingRight: i < 3 ? 10 : 0,
                  borderRight: i < 3 ? '1px solid rgba(242,237,228,0.15)' : 'none',
                }}
              >
                <p
                  style={{
                    fontFamily: "'Barlow Condensed', sans-serif",
                    fontSize: 9,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    color: 'rgba(242,237,228,0.5)',
                    marginBottom: 4,
                  }}
                >
                  {stat.label}
                </p>
                <p
                  style={{
                    fontFamily: "'Barlow Condensed', sans-serif",
                    fontSize: 20,
                    fontWeight: 700,
                    color: stat.gold ? '#B8963E' : '#F2EDE4',
                    lineHeight: 1,
                  }}
                >
                  {stat.value}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Content area — leaderboard + chat */}
      <div className="px-4 sm:px-6 py-6">
        <div className="max-w-[680px] mx-auto space-y-5">
          {/* Leaderboard */}
          <Leaderboard />

          {/* Chat */}
          <Thread />

          {/* Final CTA */}
          <div className="pt-4">
            <div className="h-px bg-gold-dark/30 mb-6" />
            <div className="text-center">
              <p className="font-display italic text-forest text-[18px] sm:text-[22px]">
                Sådan kunne din liga se ud.
              </p>
              <div className="mt-5 hidden sm:flex flex-wrap justify-center gap-3">
                <Link
                  href="/register"
                  className="inline-flex items-center justify-center px-8 py-4 bg-gold text-forest font-condensed font-bold text-[13px] uppercase tracking-widest rounded-sm hover:opacity-90 transition-opacity"
                >
                  Start din egen liga →
                </Link>
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex items-center justify-center px-8 py-4 bg-transparent border border-warm-border text-warm-gray hover:text-forest hover:border-forest font-condensed font-bold text-[13px] uppercase tracking-widest rounded-sm transition-colors"
                >
                  Luk demo
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

// ─── Production-mirror MatchCard ───────────────────────────────────────────

function MatchCard({
  match,
  selected,
  mode,
  onTip,
  revealed,
  userPick,
  correctOutcome,
  isCorrect,
  score,
  stake,
  onAdjustStake,
  remainingBudget,
  compact,
  distribution,
}: {
  match: Match
  selected?: Tip
  mode: 'open' | 'finished'
  onTip?: (t: Tip) => void
  revealed?: boolean
  userPick?: Tip | null
  correctOutcome?: Tip
  isCorrect?: boolean
  score?: { home: number; away: number }
  stake?: number
  onAdjustStake?: (delta: number) => void
  remainingBudget?: number
  /** Skip inline stake-row (når kuponen håndterer stakes separat) */
  compact?: boolean
  /** Vises i finished mode efter reveal — odds + % per outcome (mirror af AfgivBets bet distribution) */
  distribution?: Distribution
}) {
  const isRivalry = !!match.derby
  const isFinished = mode === 'finished' && revealed

  // Card surface follows AfgivBets:
  //   - Rivalry → dark green surface, gold border
  //   - Regular → white surface, subtle border (forest if user has selected)
  const cardBg = isRivalry ? 'bg-forest' : 'bg-white'
  const hasSelection = !!selected
  const cardBorder = isRivalry
    ? 'border-gold'
    : hasSelection
      ? 'border-forest shadow-[0_0_0_1px_#1a3329]'
      : 'border-warm-border'
  const textPrimary = isRivalry ? 'text-cream' : 'text-forest'
  const textSecondary = isRivalry ? 'text-cream/50' : 'text-warm-taupe'

  return (
    <div
      className={`${cardBg} border rounded-sm overflow-hidden transition-colors ${cardBorder}`}
      style={{ fontFamily: "'Barlow', sans-serif" }}
    >
      {/* Rivalry badge */}
      {isRivalry && (
        <div className="flex items-center gap-1.5 px-2.5 pt-1.5 pb-0">
          <span className="text-[10px]" aria-hidden>
            🔥
          </span>
          <span
            className="font-condensed text-[10px] font-bold uppercase tracking-widest"
            style={{ color: '#B8963E' }}
          >
            {match.derby} {match.multiplier && `· ${match.multiplier}`}
          </span>
        </div>
      )}

      {/* Teams + kickoff/score */}
      <div className="px-2.5 pt-1.5">
        <div className="flex items-center justify-between gap-2 h-8">
          <div className="flex items-center gap-1.5 flex-1 min-w-0 justify-end">
            <span
              className={`font-condensed font-bold text-[13px] sm:text-[14px] ${textPrimary} truncate`}
              style={{ maxWidth: 110 }}
            >
              {match.homeShort}
            </span>
            <img
              src={match.homeLogo}
              alt=""
              className="shrink-0"
              style={{ width: 20, height: 20, objectFit: 'contain' }}
              loading="lazy"
            />
          </div>

          {isFinished && score ? (
            <span className={`font-condensed font-bold text-[12px] ${textSecondary} flex-shrink-0`}>
              {score.home} – {score.away}
            </span>
          ) : (
            <span className={`text-[9px] ${textSecondary} font-semibold flex-shrink-0`}>vs</span>
          )}

          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <img
              src={match.awayLogo}
              alt=""
              className="shrink-0"
              style={{ width: 20, height: 20, objectFit: 'contain' }}
              loading="lazy"
            />
            <span
              className={`font-condensed font-bold text-[13px] sm:text-[14px] ${textPrimary} truncate`}
              style={{ maxWidth: 110 }}
            >
              {match.awayShort}
            </span>
          </div>
        </div>
        <div className="text-center">
          <span className={`text-[9px] ${textSecondary}`}>
            {isFinished ? 'Færdig' : match.kickoff}
          </span>
        </div>
      </div>

      {/* 1/X/2 buttons */}
      <div className="flex gap-1 px-2.5 pt-1 pb-1.5">
        {(['1', 'X', '2'] as Tip[]).map((o) => {
          const active = mode === 'open' ? selected === o : userPick === o
          const isUserPick = isFinished && userPick === o
          const isCorrectOutcome = isFinished && correctOutcome === o
          const isUserCorrect = isUserPick && !!isCorrect

          let btnClass = ''
          if (isFinished && (isUserPick || isCorrectOutcome)) {
            if (isUserCorrect) {
              // Bruger valgte rigtigt → forest fyldt + gold dobbelt-ramme
              btnClass = 'bg-forest border-gold border-[2.5px] shadow-[0_0_0_1px_#B8963E]'
            } else if (isUserPick) {
              // Bruger valgte forkert → forest fyldt, ingen gold
              btnClass = 'bg-forest border-forest opacity-60'
            } else if (isCorrectOutcome) {
              // Det rigtige svar (men brugeren tog det ikke) → cream + gold ramme
              btnClass = isRivalry
                ? 'bg-forest-light border-gold border-[2.5px]'
                : 'bg-cream border-gold border-[2.5px]'
            }
          } else if (active) {
            btnClass = isRivalry ? 'bg-gold border-gold' : 'bg-forest border-forest'
          } else {
            btnClass = isRivalry
              ? 'bg-forest-light border-gold/30 hover:border-gold'
              : 'bg-cream border-warm-border hover:border-forest'
          }

          const sub = o === '1' ? match.homeShort.split(' ')[0] : o === '2' ? match.awayShort.split(' ')[0] : 'Uafgjort'
          const textLight = active || isUserPick || (isFinished && isCorrectOutcome && isRivalry)
          const labelColor = textLight
            ? isRivalry && active
              ? 'text-forest'
              : 'text-cream'
            : isRivalry
              ? 'text-cream/70'
              : 'text-warm-taupe'
          const subColor = textLight
            ? isRivalry && active
              ? 'text-forest/60'
              : 'text-cream/60'
            : isRivalry
              ? 'text-cream/40'
              : 'text-warm-taupe'

          return (
            <button
              key={o}
              type="button"
              disabled={mode === 'finished' || !onTip}
              onClick={() => onTip?.(o)}
              aria-pressed={active}
              className={`flex-1 py-1 border-[1.5px] rounded-md flex flex-col items-center gap-0.5 transition-all ${btnClass} ${
                mode === 'finished' ? 'cursor-default' : 'cursor-pointer'
              }`}
            >
              <span className={`font-condensed text-[15px] sm:text-[16px] font-bold leading-none ${labelColor}`}>
                {o}
              </span>
              <span className={`text-[8px] font-medium truncate max-w-full ${subColor}`}>
                {sub}
              </span>
            </button>
          )
        })}
      </div>

      {/* Stake-row — vises kun når der er valgt et tip og card ikke er kompakt */}
      {!compact && mode === 'open' && selected && stake !== undefined && onAdjustStake && (
        <div
          className={
            'flex items-center gap-2 px-3 py-1.5 border-t ' +
            (isRivalry ? 'border-gold/20' : 'border-black/[0.06]')
          }
        >
          <span
            className={
              'text-[10px] font-bold uppercase tracking-wider ' +
              (isRivalry ? 'text-gold/70' : 'text-warm-taupe')
            }
          >
            Stake
          </span>
          <div className="flex items-center gap-1 ml-auto">
            <button
              type="button"
              onClick={() => onAdjustStake(-STAKE_STEP)}
              disabled={stake <= MIN_STAKE}
              aria-label="Mindre stake"
              className={
                'w-7 h-7 border rounded font-bold text-sm flex items-center justify-center disabled:opacity-30 ' +
                (isRivalry
                  ? 'border-gold/30 bg-forest-light text-cream'
                  : 'border-warm-border bg-cream text-forest hover:border-forest')
              }
            >
              −
            </button>
            <div
              className={
                'w-14 text-center font-condensed text-[14px] font-bold border rounded h-7 leading-7 tabular-nums ' +
                (isRivalry
                  ? 'border-gold/30 bg-forest-light text-cream'
                  : 'border-warm-border bg-cream text-forest')
              }
            >
              {stake}
            </div>
            <span
              className={
                'text-[10px] font-semibold ' +
                (isRivalry ? 'text-cream/50' : 'text-warm-taupe')
              }
            >
              pt
            </span>
            <button
              type="button"
              onClick={() => onAdjustStake(STAKE_STEP)}
              disabled={remainingBudget !== undefined && remainingBudget < STAKE_STEP}
              aria-label="Større stake"
              className={
                'w-7 h-7 border rounded font-bold text-sm flex items-center justify-center disabled:opacity-30 ' +
                (isRivalry
                  ? 'border-gold/30 bg-forest-light text-cream'
                  : 'border-warm-border bg-cream text-forest hover:border-forest')
              }
            >
              +
            </button>
          </div>
        </div>
      )}

      {/* Bet distribution — odds + % per outcome (matcher AfgivBets) */}
      {mode === 'finished' && revealed && distribution && (
        <div
          className={
            'px-2.5 py-2 border-t ' +
            (isRivalry ? 'border-gold/20' : 'border-black/[0.06]')
          }
        >
          <div className="flex gap-1 items-stretch">
            {(['1', 'X', '2'] as const).map((opt) => {
              const data = distribution[opt]
              const maxPct = Math.max(distribution['1'].pct, distribution.X.pct, distribution['2'].pct)
              const isHighest = data.pct === maxPct && data.pct > 0
              const valueColor = isHighest ? 'text-gold-dark' : isRivalry ? 'text-cream/55' : 'text-warm-taupe'
              return (
                <div key={opt} className="flex-1 text-center">
                  <div
                    className={
                      'font-condensed text-[10px] font-bold uppercase ' +
                      (isRivalry ? 'text-cream/45' : 'text-warm-taupe')
                    }
                  >
                    {opt}
                  </div>
                  <div
                    className={
                      'font-condensed text-[12px] tabular-nums ' +
                      (isRivalry ? 'text-cream/55' : 'text-warm-taupe')
                    }
                    style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
                  >
                    {data.odds.toFixed(2)}
                  </div>
                  <div
                    className={'font-condensed text-[13px] font-bold tabular-nums ' + valueColor}
                    style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
                  >
                    {data.pct}%
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Stake-row read-only på færdige kampe */}
      {mode === 'finished' && revealed && stake !== undefined && (
        <div
          className={
            'flex items-center justify-between px-3 py-1.5 border-t ' +
            (isRivalry ? 'border-gold/20' : 'border-black/[0.06]')
          }
        >
          <span
            className={
              'text-[10px] font-bold uppercase tracking-wider ' +
              (isRivalry ? 'text-gold/70' : 'text-warm-taupe')
            }
          >
            Stake
          </span>
          <span
            className={
              'font-condensed font-bold text-[13px] tabular-nums ' +
              (isCorrect ? 'text-gold-dark' : 'text-vintage-red')
            }
          >
            {isCorrect ? '+' : '−'}
            {stake} pt
          </span>
        </div>
      )}
    </div>
  )
}

// ─── Production-mirror Leaderboard ─────────────────────────────────────────

function Leaderboard() {
  return (
    <div>
      <span
        className="font-condensed"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#9E9486' }}
      >
        Leaderboard
      </span>
      <div
        className="mt-2 rounded-sm overflow-hidden"
        style={{ background: '#FDFAF5', border: '1px solid #E8E0D3' }}
      >
        {/* Header */}
        <div
          className="grid items-center"
          style={{
            gridTemplateColumns: '28px 1fr 44px 52px 44px 52px',
            padding: '8px 10px',
            borderBottom: '1px solid #E8E0D3',
            gap: 4,
          }}
        >
          {['#', '', 'R. sejr', 'R. point', 'B. sejr', 'B. point'].map((h, i) => (
            <span
              key={i}
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                fontSize: 9,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: '#9E9486',
                textAlign: i >= 2 ? 'right' : 'left',
              }}
            >
              {h}
            </span>
          ))}
        </div>

        {/* Rows */}
        {LEADERBOARD.map((row, idx) => {
          const rankColor =
            idx === 0 ? '#B8963E' : idx === 1 ? '#7A7A7A' : idx === 2 ? '#A0785A' : '#9E9486'
          const isUser = row.isUser
          return (
            <div
              key={row.pos}
              className="grid items-center"
              style={{
                gridTemplateColumns: '28px 1fr 44px 52px 44px 52px',
                padding: '10px 10px',
                borderBottom: idx < LEADERBOARD.length - 1 ? '1px solid #E8E0D3' : 'none',
                borderLeft: isUser ? '2px solid #B8963E' : '2px solid transparent',
                gap: 4,
                background: isUser ? '#F8F5ED' : idx === 0 ? '#FBF7EE' : 'transparent',
              }}
            >
              <span
                style={{
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontSize: 14,
                  fontWeight: 700,
                  color: rankColor,
                }}
              >
                {row.pos}
              </span>
              <span
                style={{
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontSize: 13,
                  fontWeight: isUser ? 700 : 600,
                  color: isUser ? '#1a3329' : '#1a1a1a',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {row.name}
              </span>
              <NumCell value={row.roundWins} highlight />
              <NumCell value={row.roundPoints} />
              <NumCell value={row.blockWins} highlight />
              <NumCell value={row.blockPoints} bold />
            </div>
          )
        })}
      </div>
    </div>
  )
}

function NumCell({ value, highlight, bold }: { value: number; highlight?: boolean; bold?: boolean }) {
  const isZero = value === 0
  return (
    <span
      style={{
        fontFamily: "'Barlow Condensed', sans-serif",
        fontSize: bold ? 13 : 12,
        fontWeight: bold ? 700 : 600,
        color: isZero ? '#ccc' : highlight && value > 0 ? '#B8963E' : '#1a1a1a',
        textAlign: 'right',
      }}
    >
      {isZero ? '-' : value}
    </span>
  )
}

// ─── Production-mirror Thread ──────────────────────────────────────────────

function Thread() {
  return (
    <div>
      <span
        style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          fontSize: 11,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.12em',
          color: '#9E9486',
        }}
      >
        Tråden
      </span>
      <div
        className="mt-2 rounded-sm p-4 sm:p-5 space-y-4"
        style={{ background: '#FDFAF5', border: '1px solid #E8E0D3' }}
      >
        {CHAT_MESSAGES.map((msg) => (
          <div key={msg.name} className="flex items-start gap-3">
            <div
              className="flex-shrink-0 rounded-full flex items-center justify-center font-condensed font-bold text-[12px] sm:text-[14px]"
              style={{
                width: 32,
                height: 32,
                background: msg.avatarBg,
                color: msg.avatarFg,
                fontFamily: "'Barlow Condensed', sans-serif",
              }}
              aria-hidden
            >
              {msg.avatar}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="font-body font-semibold text-[13px] text-ink">{msg.name}</span>
                <span
                  className="text-[11px] text-warm-taupe"
                  style={{ fontFamily: "'Courier New', monospace" }}
                >
                  {msg.time}
                </span>
              </div>
              <p className="mt-1 font-body text-[14px] text-ink leading-relaxed break-words">
                {msg.body}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Shared bits ───────────────────────────────────────────────────────────

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
    <div>
      <span className="font-condensed font-bold text-[11px] uppercase tracking-[0.14em] text-gold-dark">
        {tag}
      </span>
      <h2
        id="demo-step-heading"
        className="mt-2 font-display font-black text-forest text-[26px] sm:text-[36px] leading-tight"
      >
        {title}
      </h2>
      <p className="mt-2 font-body text-[14px] sm:text-[16px] text-warm-gray leading-relaxed max-w-[520px]">
        {subtitle}
      </p>
    </div>
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
  const nextLabel = step === 1 ? 'Næste →' : step === 2 ? 'Næste →' : 'Se spilrummet →'

  return (
    <div
      className="flex-shrink-0 border-t border-warm-border bg-cream"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="px-4 sm:px-6 py-4">
        {isLast ? (
          <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-center">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-4 bg-transparent border border-warm-border text-warm-gray hover:text-forest hover:border-forest font-condensed font-bold text-[13px] uppercase tracking-widest rounded-sm transition-colors min-h-[52px]"
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
          <div className="flex flex-col-reverse sm:flex-row sm:justify-between gap-3">
            {showBack ? (
              <button
                type="button"
                onClick={onBack}
                className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-4 bg-transparent text-warm-gray hover:text-forest font-condensed font-bold text-[13px] uppercase tracking-widest rounded-sm transition-colors min-h-[52px]"
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
              className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-4 bg-forest text-cream font-condensed font-bold text-[13px] uppercase tracking-widest rounded-sm hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed min-h-[52px]"
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
        .demo-step-anim { animation: none !important; }
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
      .demo-modal-entering { animation: demoModalIn 250ms ease-out both; }
      .demo-modal-exiting  { animation: demoModalOut 200ms ease-in both; }
      .demo-step-anim       { animation: demoStepIn 200ms ease-out both; }
    `}</style>
  )
}
