'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'

// ─── Data ───────────────────────────────────────────────────────────────────

type RaceId = 'liege' | 'roubaix' | 'tdf' | 'giro'

type Race = {
  id: RaceId
  name: string
  type: 'one_day' | 'stage_race'
  stageLabel?: string
  description: string
  profile: 'mountain' | 'cobbled' | 'hilly' | 'flat'
  distance: string
  isFlagship?: boolean
}

const RACES: readonly Race[] = [
  {
    id: 'liege',
    name: 'Liège-Bastogne-Liège',
    type: 'one_day',
    description: 'Den ældste monument. Bjergrigt parkour, kuperet finale på La Redoute.',
    profile: 'mountain',
    distance: '254 km',
  },
  {
    id: 'roubaix',
    name: 'Paris-Roubaix',
    type: 'one_day',
    description: 'Brostens-helvedet. 30 sektorer cobbles, voldsom udmattelseskamp.',
    profile: 'cobbled',
    distance: '258 km',
  },
  {
    id: 'tdf',
    name: 'Tour de France',
    type: 'stage_race',
    stageLabel: 'Etape 14 — Pyrenæerne',
    description: 'Bjergetape med summit finish på Tourmalet. 4 cat-1 stigninger.',
    profile: 'mountain',
    distance: '198 km',
    isFlagship: true,
  },
  {
    id: 'giro',
    name: "Giro d'Italia",
    type: 'stage_race',
    stageLabel: 'Etape 8 — Apenninerne',
    description: 'Hilly etape med kort stejl finale. Klassisk attack-terrain.',
    profile: 'hilly',
    distance: '186 km',
  },
] as const

const PROFILE_ICONS: Record<Race['profile'], string> = {
  mountain: '⛰',
  cobbled: '⊞',
  hilly: '〜',
  flat: '—',
}

type RoleKey =
  | 'leader'
  | 'lieutenant'
  | 'grimpeur'
  | 'sprinter'
  | 'domestique'
  | 'joker'
  | 'equipier_0'
  | 'equipier_1'

type RoleDef = {
  key: RoleKey
  label: string
  description: string
  multiplier: number
}

const ROLES: readonly RoleDef[] = [
  { key: 'leader', label: 'Leader', description: 'Holdkaptajn — 1.5× point', multiplier: 1.5 },
  { key: 'lieutenant', label: 'Lieutenant', description: 'Reserve-kaptajn — 1.3× point', multiplier: 1.3 },
  { key: 'grimpeur', label: 'Grimpeur', description: 'Bjergspecialist — 1.2× på bjerg', multiplier: 1.2 },
  { key: 'sprinter', label: 'Sprinter', description: 'Sprint-specialist — 1.2× på flad', multiplier: 1.2 },
  { key: 'domestique', label: 'Domestique', description: 'Workhorse — 1.1× point', multiplier: 1.1 },
  { key: 'joker', label: 'Joker', description: '2× point — DNF koster dobbelt', multiplier: 2.0 },
  { key: 'equipier_0', label: 'Équipier', description: 'Standardrolle — 1.0× point', multiplier: 1.0 },
  { key: 'equipier_1', label: 'Équipier', description: 'Standardrolle — 1.0× point', multiplier: 1.0 },
] as const

type Rider = {
  id: string
  firstName: string
  lastName: string
  team: string
  cat: 1 | 2 | 3 | 4 | 5
  photo: string
  teamLogo: string
}

// 25-mands squad fra produktet (rigtige rytter-data + PCS-fotos)
const SQUAD: readonly Rider[] = [
  // Cat 1 (3 ryttere — toppen)
  { id: 'pogacar', firstName: 'Tadej', lastName: 'POGAČAR', team: 'UAE Team Emirates - XRG', cat: 1, photo: 'https://www.procyclingstats.com/images/riders/oh/em/tadej-pogacar-2026.jpg', teamLogo: 'https://www.procyclingstats.com/images/shirts/bx/eb/uae-team-emirates-xrg-2026.png' },
  { id: 'vingegaard', firstName: 'Jonas', lastName: 'VINGEGAARD', team: 'Team Visma | Lease a Bike', cat: 1, photo: 'https://www.procyclingstats.com/images/riders/vg/em/jonas-vingegaard-2026-n2-n3.jpg', teamLogo: 'https://www.procyclingstats.com/images/shirts/bx/eb/team-visma-lease-a-bike-2026-n2.png' },
  { id: 'van-aert', firstName: 'Wout', lastName: 'VAN AERT', team: 'Team Visma | Lease a Bike', cat: 1, photo: 'https://www.procyclingstats.com/images/riders/vg/em/wout-van-aert-2026-n2-n3.jpg', teamLogo: 'https://www.procyclingstats.com/images/shirts/bx/eb/team-visma-lease-a-bike-2026-n2.png' },
  // Cat 2 (5 ryttere)
  { id: 'roglic', firstName: 'Primož', lastName: 'ROGLIČ', team: 'Red Bull - BORA - hansgrohe', cat: 2, photo: 'https://www.procyclingstats.com/images/riders/gu/em/primoz-roglic-2026.jpg', teamLogo: 'https://www.procyclingstats.com/images/shirts/bx/eb/red-bull-bora-hansgrohe-2026.png' },
  { id: 'jorgenson', firstName: 'Matteo', lastName: 'JORGENSON', team: 'Team Visma | Lease a Bike', cat: 2, photo: 'https://www.procyclingstats.com/images/riders/vg/em/matteo-jorgenson-2026-n2-n3.jpg', teamLogo: 'https://www.procyclingstats.com/images/shirts/bx/eb/team-visma-lease-a-bike-2026-n2.png' },
  { id: 'yates', firstName: 'Adam', lastName: 'YATES', team: 'UAE Team Emirates - XRG', cat: 2, photo: 'https://www.procyclingstats.com/images/riders/oh/em/adam-yates-2026.jpg', teamLogo: 'https://www.procyclingstats.com/images/shirts/bx/eb/uae-team-emirates-xrg-2026.png' },
  { id: 'skjelmose', firstName: 'Mattias', lastName: 'SKJELMOSE', team: 'Lidl - Trek', cat: 2, photo: 'https://www.procyclingstats.com/images/riders/my/em/mattias-skjelmose-jensen-2026.jpg', teamLogo: 'https://www.procyclingstats.com/images/shirts/bx/eb/lidl-trek-2026.png' },
  { id: 'bernal', firstName: 'Egan', lastName: 'BERNAL', team: 'Netcompany INEOS', cat: 2, photo: 'https://www.procyclingstats.com/images/riders/ge/em/egan-bernal-2026-n2-n3.png', teamLogo: 'https://www.procyclingstats.com/images/shirts/bx/eb/ineos-grenadiers-2026-n2.png' },
  // Cat 3 (5 ryttere)
  { id: 'alaphilippe', firstName: 'Julian', lastName: 'ALAPHILIPPE', team: 'Tudor Pro Cycling Team', cat: 3, photo: 'https://www.procyclingstats.com/images/riders/yu/em/julian-alaphilippe-2026.jpg', teamLogo: 'https://www.procyclingstats.com/images/shirts/bx/eb/tudor-pro-cycling-team-2026.png' },
  { id: 'arensman', firstName: 'Thymen', lastName: 'ARENSMAN', team: 'Netcompany INEOS', cat: 3, photo: 'https://www.procyclingstats.com/images/riders/ge/em/thymen-arensman-2026-n2-n3-n4.png', teamLogo: 'https://www.procyclingstats.com/images/shirts/bx/eb/ineos-grenadiers-2026-n2.png' },
  { id: 'ganna', firstName: 'Filippo', lastName: 'GANNA', team: 'Netcompany INEOS', cat: 3, photo: 'https://www.procyclingstats.com/images/riders/ge/em/filippo-ganna-2026-n2-n3.png', teamLogo: 'https://www.procyclingstats.com/images/shirts/bx/eb/ineos-grenadiers-2026-n2.png' },
  { id: 'uijtdebroeks', firstName: 'Cian', lastName: 'UIJTDEBROEKS', team: 'Movistar Team', cat: 3, photo: 'https://www.procyclingstats.com/images/riders/kb/em/cian-uijtdebroeks-2026.png', teamLogo: 'https://www.procyclingstats.com/images/shirts/bx/eb/movistar-team-2026-n2.png' },
  { id: 'aranburu', firstName: 'Alex', lastName: 'ARANBURU', team: 'Cofidis', cat: 3, photo: 'https://www.procyclingstats.com/images/riders/hh/em/alex-aranburu-2026-n2-n3.jpg', teamLogo: 'https://www.procyclingstats.com/images/shirts/bx/eb/cofidis-2026-n2.png' },
  // Cat 4 (5 ryttere)
  { id: 'turner', firstName: 'Ben', lastName: 'TURNER', team: 'Netcompany INEOS', cat: 4, photo: 'https://www.procyclingstats.com/images/riders/eb/em/ben-turner-2026-n2-n3.png', teamLogo: 'https://www.procyclingstats.com/images/shirts/bx/eb/ineos-grenadiers-2026-n2.png' },
  { id: 'vlasov', firstName: 'Aleksandr', lastName: 'VLASOV', team: 'Red Bull - BORA - hansgrohe', cat: 4, photo: 'https://www.procyclingstats.com/images/riders/gu/em/aleksandr-vlasov-2026.jpg', teamLogo: 'https://www.procyclingstats.com/images/shirts/bx/eb/red-bull-bora-hansgrohe-2026.png' },
  { id: 'ackermann', firstName: 'Pascal', lastName: 'ACKERMANN', team: 'Team Jayco AlUla', cat: 4, photo: 'https://www.procyclingstats.com/images/riders/eb/em/pascal-ackermann-2026.jpg', teamLogo: 'https://www.procyclingstats.com/images/shirts/bx/eb/team-jayco-alula-2026.png' },
  { id: 'armirail', firstName: 'Bruno', lastName: 'ARMIRAIL', team: 'Team Visma | Lease a Bike', cat: 4, photo: 'https://www.procyclingstats.com/images/riders/vg/em/bruno-armirail-2026-n2.jpg', teamLogo: 'https://www.procyclingstats.com/images/shirts/bx/eb/team-visma-lease-a-bike-2026-n2.png' },
  { id: 'arrieta', firstName: 'Igor', lastName: 'ARRIETA', team: 'UAE Team Emirates - XRG', cat: 4, photo: 'https://www.procyclingstats.com/images/riders/oh/em/igor-arrieta-2026.jpg', teamLogo: 'https://www.procyclingstats.com/images/shirts/bx/eb/uae-team-emirates-xrg-2026.png' },
  // Cat 5 (7 ryttere)
  { id: 'adria', firstName: 'Roger', lastName: 'ADRIÀ', team: 'Movistar Team', cat: 5, photo: 'https://www.procyclingstats.com/images/riders/kb/em/roger-adria-2026.jpg', teamLogo: 'https://www.procyclingstats.com/images/shirts/bx/eb/movistar-team-2026-n2.png' },
  { id: 'affini', firstName: 'Edoardo', lastName: 'AFFINI', team: 'Team Visma | Lease a Bike', cat: 5, photo: 'https://www.procyclingstats.com/images/riders/vg/em/edoardo-affini-2026-n2.jpg', teamLogo: 'https://www.procyclingstats.com/images/shirts/bx/eb/team-visma-lease-a-bike-2026-n2.png' },
  { id: 'albanese', firstName: 'Vincenzo', lastName: 'ALBANESE', team: 'EF Education - EasyPost', cat: 5, photo: 'https://www.procyclingstats.com/images/riders/yz/em/vincenzo-albanese-2026.jpg', teamLogo: 'https://www.procyclingstats.com/images/shirts/bx/eb/ef-education-easypost-2026.png' },
  { id: 'aleotti', firstName: 'Giovanni', lastName: 'ALEOTTI', team: 'Red Bull - BORA - hansgrohe', cat: 5, photo: 'https://www.procyclingstats.com/images/riders/gu/em/giovanni-aleotti-2026.jpg', teamLogo: 'https://www.procyclingstats.com/images/shirts/bx/eb/red-bull-bora-hansgrohe-2026.png' },
  { id: 'allegaert', firstName: 'Piet', lastName: 'ALLEGAERT', team: 'Cofidis', cat: 5, photo: 'https://www.procyclingstats.com/images/riders/hh/em/piet-allegaert-2026-n2.jpg', teamLogo: 'https://www.procyclingstats.com/images/shirts/bx/eb/cofidis-2026-n2.png' },
  { id: 'aerts', firstName: 'Toon', lastName: 'AERTS', team: 'Lotto Intermarché', cat: 5, photo: 'https://www.procyclingstats.com/images/riders/mj/em/toon-aerts-2026.jpg', teamLogo: 'https://www.procyclingstats.com/images/shirts/bx/eb/lotto-intermarche-2026.png' },
  { id: 'agostinacchio', firstName: 'Mattia', lastName: 'AGOSTINACCHIO', team: 'EF Education - EasyPost', cat: 5, photo: 'https://www.procyclingstats.com/images/riders/yz/em/mattia-agostinacchio-2026.jpg', teamLogo: 'https://www.procyclingstats.com/images/shirts/bx/eb/ef-education-easypost-2026.png' },
] as const

// Fælles resultat-konfiguration (samme på tværs af løb-valg for v1).
// position 0 = vinder. dnf-array = ryttere der ikke finished.
type RaceResult = {
  // rider_id → finish position (1-25, eller null = DNF)
  positions: Record<string, number | null>
  topPositions: { riderId: string; pos: number; gap: string }[]
}

const RACE_RESULT: RaceResult = {
  positions: {
    pogacar: 1,
    vingegaard: 2,
    skjelmose: 3,
    'van-aert': 4,
    yates: 5,
    bernal: 6,
    jorgenson: 7,
    arensman: 8,
    uijtdebroeks: 9,
    alaphilippe: 10,
    aranburu: 11,
    ganna: 12,
    armirail: 13,
    vlasov: 14,
    arrieta: 15,
    aleotti: 16,
    affini: 17,
    albanese: 18,
    adria: 19,
    allegaert: 20,
    'agostinacchio': 21,
    'aerts': 22,
    'turner': 23,
    'ackermann': null, // DNF
    'roglic': null, // DNF — joker-fælde
  },
  topPositions: [
    { riderId: 'pogacar', pos: 1, gap: '5h 12:34' },
    { riderId: 'vingegaard', pos: 2, gap: '+0:08' },
    { riderId: 'skjelmose', pos: 3, gap: '+0:34' },
    { riderId: 'van-aert', pos: 4, gap: '+1:12' },
    { riderId: 'yates', pos: 5, gap: '+1:48' },
    { riderId: 'bernal', pos: 6, gap: '+2:21' },
    { riderId: 'jorgenson', pos: 7, gap: '+3:04' },
    { riderId: 'arensman', pos: 8, gap: '+3:39' },
    { riderId: 'uijtdebroeks', pos: 9, gap: '+4:15' },
    { riderId: 'alaphilippe', pos: 10, gap: '+5:02' },
  ],
}

// Base-points per finish-position (mirrer produktets simple model)
function basePointsForPosition(pos: number | null): number {
  if (pos === null) return 0
  const table: Record<number, number> = { 1: 50, 2: 35, 3: 25, 4: 20, 5: 17, 6: 15, 7: 13, 8: 11, 9: 9, 10: 7 }
  if (table[pos] !== undefined) return table[pos]
  if (pos <= 20) return 5
  if (pos <= 30) return 2
  return 1
}

const CAT_COLORS: Record<number, string> = {
  1: '#B8963E', // gold
  2: '#6B8F71', // forest tint
  3: '#4A6FA5', // blue
  4: '#8B6F47', // bronze
  5: '#7A7060', // taupe
}

// ─── Rider avatar med onError-fallback til initialer ──────────────────────

function RiderAvatar({
  rider,
  size = 36,
  className = '',
}: {
  rider: Rider
  size?: number
  className?: string
}) {
  const [errored, setErrored] = useState(false)
  const initial = rider.lastName.charAt(0)
  const ringColor = CAT_COLORS[rider.cat]

  if (errored || !rider.photo) {
    return (
      <div
        className={`flex items-center justify-center rounded-full flex-shrink-0 ${className}`}
        style={{
          width: size,
          height: size,
          background: ringColor,
          color: '#F2EDE4',
          border: `2px solid ${ringColor}`,
          fontFamily: "'Barlow Condensed', sans-serif",
          fontSize: Math.max(11, Math.round(size * 0.4)),
          fontWeight: 700,
        }}
        aria-hidden
      >
        {initial}
      </div>
    )
  }

  return (
    <img
      src={rider.photo}
      alt=""
      onError={() => setErrored(true)}
      className={`rounded-full object-cover flex-shrink-0 ${className}`}
      style={{
        width: size,
        height: size,
        border: `2px solid ${ringColor}`,
        background: 'rgba(212,207,196,0.4)',
      }}
      loading="lazy"
    />
  )
}

function TeamLogo({
  url,
  height = 12,
  maxWidth = 36,
}: {
  url: string
  height?: number
  maxWidth?: number
}) {
  const [errored, setErrored] = useState(false)
  if (errored || !url) {
    // Lille generic-jersey ikon som fallback (et farvet rectangle med subtil gradient)
    return (
      <span
        className="inline-block flex-shrink-0 rounded-sm"
        style={{
          height,
          width: Math.round(height * 0.85),
          background: 'linear-gradient(135deg, #D4CFC4 0%, #C0B8A8 100%)',
        }}
        aria-hidden
      />
    )
  }
  return (
    <img
      src={url}
      alt=""
      onError={() => setErrored(true)}
      className="object-contain flex-shrink-0"
      style={{ height, width: 'auto', maxWidth }}
      loading="lazy"
    />
  )
}

// ─── Component ──────────────────────────────────────────────────────────────

type Props = { open: boolean; onClose: () => void }

export default function CyclingDemoModal({ open, onClose }: Props) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
  const [selectedRace, setSelectedRace] = useState<RaceId | null>(null)
  const [lineup, setLineup] = useState<Record<RoleKey, string | null>>({
    leader: null,
    lieutenant: null,
    grimpeur: null,
    sprinter: null,
    domestique: null,
    joker: null,
    equipier_0: null,
    equipier_1: null,
  })
  const [pickerForRole, setPickerForRole] = useState<RoleKey | null>(null)
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
        setSelectedRace(null)
        setLineup({
          leader: null, lieutenant: null, grimpeur: null, sprinter: null,
          domestique: null, joker: null, equipier_0: null, equipier_1: null,
        })
        setPickerForRole(null)
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
        if (pickerForRole) {
          setPickerForRole(null)
        } else {
          onClose()
        }
      } else if (e.key === 'Tab' && dialogRef.current) {
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
  }, [mounted, onClose, reducedMotion, pickerForRole])

  if (!mounted) return null

  const currentRace = selectedRace ? RACES.find((r) => r.id === selectedRace)! : null
  const filledRoles = ROLES.filter((r) => lineup[r.key] !== null).length

  function selectRace(id: RaceId) {
    setSelectedRace(id)
  }
  function setSlot(role: RoleKey, riderId: string | null) {
    setLineup((prev) => ({ ...prev, [role]: riderId }))
  }
  function autoFillLineup() {
    setLineup({ ...SUGGESTED_LINEUP } as Record<RoleKey, string | null>)
  }
  function assignRider(riderId: string) {
    if (!pickerForRole) return
    // Hvis rytter allerede er i andet slot, fjern den fra det andet slot
    const existing = (Object.entries(lineup) as [RoleKey, string | null][]).find(
      ([k, v]) => v === riderId && k !== pickerForRole,
    )
    setLineup((prev) => {
      const next = { ...prev, [pickerForRole]: riderId }
      if (existing) next[existing[0]] = null
      return next
    })
    setPickerForRole(null)
  }

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="cycling-demo-heading"
      className={`fixed inset-0 z-[100] flex items-stretch sm:items-center sm:justify-center bg-forest/80 backdrop-blur-md ${
        exiting ? 'cyc-modal-exiting' : 'cyc-modal-entering'
      }`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <DemoStyles reducedMotion={reducedMotion} />

      <div
        className="relative bg-cream w-full sm:max-w-3xl sm:max-h-[92vh] sm:rounded-sm flex flex-col overflow-hidden"
        style={{ fontFamily: "'Barlow', sans-serif", paddingTop: 'env(safe-area-inset-top)' }}
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

        {/* Step content */}
        <div className="flex-1 overflow-y-auto overscroll-contain bg-cream">
          <div key={step} className="cyc-step-anim" aria-live="polite">
            {step === 1 && <Step1ChooseRace selectedRace={selectedRace} onSelect={selectRace} />}
            {step === 2 && currentRace && (
              <Step2BuildLineup
                race={currentRace}
                lineup={lineup}
                onOpenPicker={(role) => setPickerForRole(role)}
                onClearSlot={(role) => setSlot(role, null)}
                onAutoFill={autoFillLineup}
              />
            )}
            {step === 3 && currentRace && (
              <Step3RaceResult race={currentRace} lineup={lineup} reducedMotion={reducedMotion} />
            )}
            {step === 4 && (
              <Step4Spilrum
                race={currentRace ?? RACES[2]}
                onClose={onClose}
              />
            )}
          </div>
        </div>

        {/* Rider picker overlay — søsken til scroll-area så den dækker hele
            modal-rammen i stedet for at scrolle med step-indholdet */}
        {pickerForRole && (
          <RiderPickerSheet
            role={ROLES.find((r) => r.key === pickerForRole)!}
            currentRiderId={lineup[pickerForRole]}
            alreadyAssigned={lineup}
            onPick={assignRider}
            onClose={() => setPickerForRole(null)}
            reducedMotion={reducedMotion}
          />
        )}

        {/* Footer nav */}
        <FooterNav
          step={step}
          canAdvance={
            (step === 1 && selectedRace !== null) ||
            (step === 2 && filledRoles === ROLES.length) ||
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

// ─── Step 1: Vælg løb ──────────────────────────────────────────────────────

function Step1ChooseRace({
  selectedRace,
  onSelect,
}: {
  selectedRace: RaceId | null
  onSelect: (id: RaceId) => void
}) {
  return (
    <div className="px-4 sm:px-6 pt-4 pb-8">
      <div>
        <span className="font-condensed font-bold text-[11px] uppercase tracking-[0.14em] text-gold-dark">
          Trin 1 af 4
        </span>
        <h2
          id="cycling-demo-heading"
          className="mt-2 font-display font-black text-forest text-[26px] sm:text-[36px] leading-tight"
        >
          Vælg dit løb.
        </h2>
        <p className="mt-2 font-body text-[14px] sm:text-[16px] text-warm-gray leading-relaxed max-w-[520px]">
          Et endagsløb afgøres på én dag. Et etapeløb går over flere uger — hver etape får sin egen point-runde.
        </p>
      </div>

      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-6 auto-rows-fr">
        {RACES.map((race) => {
          const isSelected = selectedRace === race.id
          return (
            <li key={race.id} className="h-full">
              <button
                type="button"
                onClick={() => onSelect(race.id)}
                aria-pressed={isSelected}
                className={
                  'w-full h-full text-left p-4 sm:p-5 rounded-sm transition-colors min-h-[120px] relative bg-white ' +
                  (isSelected
                    ? 'border-2 border-forest shadow-[0_0_0_1px_#1a3329] '
                    : race.isFlagship
                      ? 'border-2 border-gold-dark/60 hover:border-gold-dark '
                      : 'border border-warm-border hover:border-forest ')
                }
              >
                {race.isFlagship && (
                  <span className="absolute top-3 right-3 font-condensed font-bold text-[9px] uppercase tracking-[0.12em] text-gold-dark">
                    Mest spillet
                  </span>
                )}
                <div className="flex items-baseline gap-2">
                  <span aria-hidden className="text-[16px]">{PROFILE_ICONS[race.profile]}</span>
                  <span className="font-condensed font-bold text-[10px] uppercase tracking-[0.14em] text-warm-taupe">
                    {race.type === 'one_day' ? 'Endagsløb' : race.stageLabel ?? 'Etapeløb'}
                  </span>
                </div>
                <div className="mt-1.5 font-condensed font-bold text-forest text-[18px] sm:text-[20px] leading-tight pr-20">
                  {race.name}
                </div>
                <div className="mt-1 font-body text-[12px] text-warm-taupe">
                  {race.distance}
                </div>
                <div className="mt-2 font-body text-[13px] text-warm-gray leading-relaxed">
                  {race.description}
                </div>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// ─── Step 2: Sæt lineup ────────────────────────────────────────────────────

// Foreslået lineup når brugeren trykker 'Vælg for mig'. Kuratorerede valg
// der viser et stærkt lineup men stadig efterlader plads til brugeren at
// optimere via swap (joker-pick fx kan flyttes til Pogačar for større upside).
const SUGGESTED_LINEUP: Record<RoleKey, string> = {
  leader: 'pogacar',
  lieutenant: 'vingegaard',
  grimpeur: 'yates',
  sprinter: 'van-aert',
  domestique: 'jorgenson',
  joker: 'skjelmose',
  equipier_0: 'bernal',
  equipier_1: 'aranburu',
}

function Step2BuildLineup({
  race,
  lineup,
  onOpenPicker,
  onClearSlot,
  onAutoFill,
}: {
  race: Race
  lineup: Record<RoleKey, string | null>
  onOpenPicker: (role: RoleKey) => void
  onClearSlot: (role: RoleKey) => void
  onAutoFill: () => void
}) {
  const filled = ROLES.filter((r) => lineup[r.key] !== null).length
  return (
    <div className="px-4 sm:px-6 pt-3 pb-6">
      <div>
        <span className="font-condensed font-bold text-[11px] uppercase tracking-[0.14em] text-gold-dark">
          Trin 2 af 4
        </span>
        <h2
          id="cycling-demo-heading"
          className="mt-1 font-display font-black text-forest text-[24px] sm:text-[30px] leading-tight"
        >
          Sæt dit lineup.
        </h2>
        <p className="mt-1.5 font-body text-[13px] sm:text-[14px] text-warm-gray leading-relaxed">
          Vælg en rytter til hver af de 8 roller fra din 25-mands brutto-trup. Rolle-multiplikator skalerer rytterens point.
        </p>
      </div>

      {/* Race-strip */}
      <div className="mt-3 inline-flex items-center gap-2 px-2.5 py-1 bg-forest text-cream rounded-sm">
        <span aria-hidden>{PROFILE_ICONS[race.profile]}</span>
        <span className="font-condensed font-bold text-[10px] uppercase tracking-[0.12em]">
          {race.name}
          {race.stageLabel && ` · ${race.stageLabel}`}
        </span>
      </div>

      {/* Filled counter + auto-fill action */}
      <div className="mt-3 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => {
            if (filled > 0) {
              const ok = window.confirm('Erstat dit nuværende lineup med vores forslag?')
              if (!ok) return
            }
            onAutoFill()
          }}
          className="inline-flex items-center gap-1.5 font-condensed font-bold text-[11px] uppercase tracking-widest text-gold-dark hover:text-forest transition-colors min-h-[36px]"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
            <path d="M10 2l1.5 5h5.5l-4.5 3.5 1.5 5.5L10 12l-4 4 1.5-5.5L3 7h5.5z" />
          </svg>
          Vælg for mig
        </button>
        <div className="flex items-baseline gap-2">
          <span className="font-condensed text-[11px] uppercase tracking-widest text-warm-taupe">
            Roller udfyldt
          </span>
          <span
            className={
              'font-condensed font-bold text-[14px] tabular-nums ' +
              (filled === ROLES.length ? 'text-gold-dark' : 'text-forest')
            }
          >
            {filled} / {ROLES.length}
          </span>
        </div>
      </div>

      {/* Role slots */}
      <ul className="mt-3 space-y-2">
        {ROLES.map((role) => {
          const riderId = lineup[role.key]
          const rider = riderId ? SQUAD.find((r) => r.id === riderId) : null
          return (
            <li key={role.key}>
              <button
                type="button"
                onClick={() => onOpenPicker(role.key)}
                className={
                  'w-full flex items-center gap-3 px-3 py-2 rounded-sm border transition-colors min-h-[60px] text-left ' +
                  (rider
                    ? 'bg-white border-forest shadow-[0_0_0_1px_#1a3329]'
                    : 'bg-white border-warm-border hover:border-forest border-dashed')
                }
              >
                {/* Role label column */}
                <div className="w-[88px] sm:w-[110px] flex-shrink-0">
                  <div className="font-condensed font-bold text-[11px] uppercase tracking-[0.12em] text-gold-dark">
                    {role.label}
                  </div>
                  <div
                    className="font-condensed text-[10px] tabular-nums"
                    style={{ color: '#9E9486', fontFamily: "'Barlow Condensed', sans-serif" }}
                  >
                    × {role.multiplier.toFixed(1)}
                  </div>
                </div>

                {/* Rider info or empty state */}
                {rider ? (
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <RiderAvatar rider={rider} size={36} />
                    <div className="min-w-0 flex-1">
                      <div className="font-condensed font-bold text-[13px] text-forest leading-tight truncate">
                        {rider.lastName}{' '}
                        <span className="text-warm-taupe font-normal">{rider.firstName}</span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <TeamLogo url={rider.teamLogo} height={12} maxWidth={40} />
                        <span className="text-[10px] text-warm-taupe truncate">
                          {rider.team}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-warm-border/40 border-2 border-dashed border-warm-border flex-shrink-0" />
                    <div className="font-body text-[13px] text-warm-taupe italic">
                      {role.description}
                    </div>
                  </div>
                )}

                {/* Action affordance */}
                <span className="font-condensed font-bold text-[11px] uppercase tracking-widest text-gold-dark flex-shrink-0 ml-auto">
                  {rider ? 'Skift' : 'Vælg'}
                </span>

                {/* Clear button (filled only) */}
                {rider && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onClearSlot(role.key)
                    }}
                    aria-label="Fjern rytter"
                    className="w-8 h-8 inline-flex items-center justify-center text-warm-taupe hover:text-vintage-red flex-shrink-0"
                  >
                    ✕
                  </button>
                )}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// ─── Rider picker sheet ────────────────────────────────────────────────────

function RiderPickerSheet({
  role,
  currentRiderId,
  alreadyAssigned,
  onPick,
  onClose,
  reducedMotion,
}: {
  role: RoleDef
  currentRiderId: string | null
  alreadyAssigned: Record<RoleKey, string | null>
  onPick: (riderId: string) => void
  onClose: () => void
  reducedMotion: boolean
}) {
  const assignedSet = useMemo(() => {
    const set = new Set<string>()
    for (const id of Object.values(alreadyAssigned)) {
      if (id) set.add(id)
    }
    return set
  }, [alreadyAssigned])

  // Cat 1 først, så cat 2, etc.
  const sorted = useMemo(() => [...SQUAD].sort((a, b) => a.cat - b.cat), [])

  return (
    <div
      className="absolute inset-0 z-20 bg-cream flex flex-col"
      style={{
        animation: reducedMotion ? undefined : 'cyc-sheet-in 250ms ease-out both',
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {/* Header — fixed at top of picker */}
      <div className="bg-cream border-b border-warm-border px-4 py-3 flex items-center gap-3 flex-shrink-0">
        <button
          type="button"
          onClick={onClose}
          aria-label="Luk picker"
          className="w-10 h-10 inline-flex items-center justify-center text-warm-gray hover:text-forest -ml-2 flex-shrink-0"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="min-w-0 flex-1">
          <div className="font-condensed font-bold text-[10px] uppercase tracking-[0.14em] text-gold-dark">
            Vælg rytter til
          </div>
          <div className="font-condensed font-bold text-forest text-[16px] leading-tight">
            {role.label} <span className="text-warm-taupe text-[12px] font-normal">×{role.multiplier.toFixed(1)}</span>
          </div>
        </div>
      </div>

      {/* Riders grouped by category — own internal scroll */}
      <div className="flex-1 overflow-y-auto overscroll-contain px-4 sm:px-6 py-3 pb-6">
        {[1, 2, 3, 4, 5].map((cat) => {
          const ridersInCat = sorted.filter((r) => r.cat === cat)
          if (ridersInCat.length === 0) return null
          return (
            <div key={cat} className="mb-5">
              <div className="font-condensed font-bold text-[10px] uppercase tracking-[0.14em] mb-2 flex items-center gap-2">
                <span
                  className="inline-block w-1.5 h-1.5 rounded-full"
                  style={{ background: CAT_COLORS[cat] }}
                  aria-hidden
                />
                <span style={{ color: CAT_COLORS[cat] }}>Kat {cat}</span>
                <span className="text-warm-taupe font-normal">· {ridersInCat.length} ryttere</span>
              </div>
              <ul className="grid grid-cols-1 gap-1.5">
                {ridersInCat.map((rider) => {
                  const isCurrent = rider.id === currentRiderId
                  const isAssignedElsewhere = assignedSet.has(rider.id) && !isCurrent
                  return (
                    <li key={rider.id}>
                      <button
                        type="button"
                        onClick={() => onPick(rider.id)}
                        className={
                          'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-sm border transition-colors text-left min-h-[52px] ' +
                          (isCurrent
                            ? 'bg-gold/10 border-gold-dark'
                            : isAssignedElsewhere
                              ? 'bg-warm-border/30 border-warm-border opacity-60'
                              : 'bg-white border-warm-border hover:border-forest active:bg-cream-dark')
                        }
                      >
                        <RiderAvatar rider={rider} size={32} />
                        <div className="min-w-0 flex-1">
                          <div className="font-condensed font-bold text-[13px] text-forest leading-tight truncate">
                            {rider.lastName}{' '}
                            <span className="text-warm-taupe font-normal">{rider.firstName}</span>
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <TeamLogo url={rider.teamLogo} height={12} maxWidth={36} />
                            <span className="text-[10px] text-warm-taupe truncate">{rider.team}</span>
                          </div>
                        </div>
                        {isCurrent && (
                          <span className="font-condensed font-bold text-[10px] uppercase tracking-widest text-gold-dark flex-shrink-0">
                            Valgt
                          </span>
                        )}
                        {isAssignedElsewhere && (
                          <span className="font-condensed font-bold text-[9px] uppercase tracking-widest text-warm-taupe flex-shrink-0">
                            Optaget
                          </span>
                        )}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Step 3: Race result ──────────────────────────────────────────────────

function Step3RaceResult({
  race,
  lineup,
  reducedMotion,
}: {
  race: Race
  lineup: Record<RoleKey, string | null>
  reducedMotion: boolean
}) {
  const [revealed, setRevealed] = useState(false)
  useEffect(() => {
    if (reducedMotion) {
      setRevealed(true)
      return
    }
    const t = window.setTimeout(() => setRevealed(true), 800)
    return () => window.clearTimeout(t)
  }, [reducedMotion])

  // Beregn point per rolle
  const breakdown = useMemo(() => {
    return ROLES.map((role) => {
      const riderId = lineup[role.key]
      if (!riderId) return { role, rider: null, pos: null, basePts: 0, total: 0 }
      const rider = SQUAD.find((r) => r.id === riderId)!
      const pos = RACE_RESULT.positions[riderId] ?? null
      const basePts = basePointsForPosition(pos)
      // Joker DNF straffer dobbelt (negative point)
      let total = basePts * role.multiplier
      if (role.key === 'joker' && pos === null) total = -25
      return { role, rider, pos, basePts, total: Math.round(total) }
    })
  }, [lineup])

  const totalPoints = breakdown.reduce((sum, b) => sum + b.total, 0)

  return (
    <div className="px-4 sm:px-6 pt-4 pb-8">
      <div>
        <span className="font-condensed font-bold text-[11px] uppercase tracking-[0.14em] text-gold-dark">
          Trin 3 af 4
        </span>
        <h2
          id="cycling-demo-heading"
          className="mt-2 font-display font-black text-forest text-[26px] sm:text-[36px] leading-tight"
        >
          Resultatet er inde.
        </h2>
        <p className="mt-2 font-body text-[14px] sm:text-[16px] text-warm-gray leading-relaxed">
          Hver rytter giver point efter placering, ganget med rolle-multiplikator. Joker giver dobbelt — men koster, hvis han DNF&apos;er.
        </p>
      </div>

      {/* Race header card */}
      <div className="mt-5 bg-forest text-cream rounded-sm overflow-hidden">
        <div className="px-4 py-3 flex items-center gap-2.5">
          <span aria-hidden className="text-[18px]">{PROFILE_ICONS[race.profile]}</span>
          <div className="min-w-0 flex-1">
            <div className="font-condensed font-bold text-[13px] uppercase tracking-[0.12em]">
              {race.name}
            </div>
            {race.stageLabel && (
              <div className="font-condensed text-[11px] text-cream/55 uppercase tracking-wider">
                {race.stageLabel}
              </div>
            )}
          </div>
          <span
            className="font-condensed text-[10px] text-cream/55"
            style={{ fontFamily: "'Courier New', monospace" }}
          >
            FÆRDIG
          </span>
        </div>

        {/* Top 10 */}
        <div className="border-t border-cream/10">
          {RACE_RESULT.topPositions.map((pos, idx) => {
            const rider = SQUAD.find((r) => r.id === pos.riderId)!
            const isUserPick = Object.values(lineup).includes(pos.riderId)
            const posColor =
              pos.pos === 1 ? '#B8963E' : pos.pos === 2 ? '#9E9E9E' : pos.pos === 3 ? '#A0785A' : 'rgba(242,237,228,0.55)'
            return (
              <div
                key={pos.riderId}
                className={
                  'grid items-center gap-2 px-3 py-1.5 ' +
                  (idx < RACE_RESULT.topPositions.length - 1 ? 'border-b border-cream/[0.06] ' : '') +
                  (isUserPick ? 'bg-gold/10' : '') +
                  (revealed ? ' cyc-result-reveal' : ' opacity-0')
                }
                style={{
                  gridTemplateColumns: '24px 28px 1fr auto',
                  animationDelay: revealed ? `${idx * 60}ms` : undefined,
                }}
              >
                <span
                  className="font-condensed font-bold text-[12px] tabular-nums"
                  style={{ color: posColor }}
                >
                  {pos.pos}
                </span>
                <RiderAvatar rider={rider} size={24} />
                <div className="min-w-0">
                  <div className="font-condensed font-bold text-[12px] text-cream leading-tight truncate">
                    {rider.lastName}{' '}
                    <span className="text-cream/55 font-normal">{rider.firstName}</span>
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <TeamLogo url={rider.teamLogo} height={10} maxWidth={30} />
                    <span className="text-[9px] text-cream/45 truncate">{rider.team}</span>
                  </div>
                </div>
                <span
                  className="font-condensed text-[11px] tabular-nums text-cream/65"
                  style={{ fontFamily: "'Courier New', monospace" }}
                >
                  {pos.gap}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Lineup breakdown */}
      <div className="mt-5">
        <div className="font-condensed font-bold text-[11px] uppercase tracking-widest text-warm-taupe mb-2">
          Dit lineup
        </div>
        <div className="bg-white border border-warm-border rounded-sm overflow-hidden">
          {breakdown.map((b, idx) => {
            const isLast = idx === breakdown.length - 1
            const isJokerDnf = b.role.key === 'joker' && b.pos === null && b.rider
            return (
              <div
                key={b.role.key}
                className={
                  'grid items-center gap-2 px-3 py-2 ' +
                  (isLast ? '' : 'border-b border-warm-border ') +
                  (revealed ? 'cyc-result-reveal' : 'opacity-0')
                }
                style={{
                  gridTemplateColumns: '90px 1fr 50px 60px',
                  animationDelay: revealed ? `${(RACE_RESULT.topPositions.length + idx) * 50}ms` : undefined,
                }}
              >
                <div>
                  <div className="font-condensed font-bold text-[10px] uppercase tracking-[0.1em] text-gold-dark">
                    {b.role.label}
                  </div>
                  <div
                    className="font-condensed text-[9px] tabular-nums"
                    style={{ color: '#9E9486' }}
                  >
                    × {b.role.multiplier.toFixed(1)}
                  </div>
                </div>
                <div className="min-w-0">
                  {b.rider ? (
                    <div className="flex items-center gap-1.5 min-w-0">
                      <RiderAvatar rider={b.rider} size={24} />
                      <span className="font-condensed font-bold text-[12px] text-forest truncate">
                        {b.rider.lastName}
                      </span>
                    </div>
                  ) : (
                    <span className="font-body text-[12px] text-warm-taupe italic">Ingen valg</span>
                  )}
                </div>
                <span
                  className={
                    'font-condensed text-[12px] tabular-nums text-right ' +
                    (b.pos === null ? 'text-vintage-red' : 'text-warm-gray')
                  }
                >
                  {b.pos === null ? 'DNF' : `${b.pos}.`}
                </span>
                <span
                  className={
                    'font-condensed font-bold text-[13px] tabular-nums text-right ' +
                    (b.total > 0
                      ? 'text-gold-dark'
                      : isJokerDnf
                        ? 'text-vintage-red'
                        : 'text-warm-taupe')
                  }
                >
                  {b.total > 0 ? '+' : ''}
                  {b.total} pt
                </span>
              </div>
            )
          })}
          {/* Total */}
          <div
            className="grid items-center gap-2 px-3 py-3 bg-cream-dark border-t border-warm-border"
            style={{ gridTemplateColumns: '90px 1fr 50px 60px' }}
          >
            <div></div>
            <div className="font-condensed font-bold text-[12px] uppercase tracking-widest text-forest">
              Total
            </div>
            <div></div>
            <div
              className={
                'font-condensed font-black text-[18px] tabular-nums text-right ' +
                (totalPoints >= 0 ? 'text-gold-dark' : 'text-vintage-red')
              }
            >
              {totalPoints >= 0 ? '+' : ''}
              {totalPoints} pt
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Step 4: Spilrum ───────────────────────────────────────────────────────

const LEADERBOARD: ReadonlyArray<{
  pos: number; name: string; roundWins: number; roundPoints: number; blockWins: number; blockPoints: number; isUser?: boolean
}> = [
  { pos: 1, name: 'Stæhr', roundWins: 4, roundPoints: 18, blockWins: 2, blockPoints: 142, isUser: true },
  { pos: 2, name: 'Nikolaj', roundWins: 2, roundPoints: 11, blockWins: 1, blockPoints: 119 },
  { pos: 3, name: 'Louise', roundWins: 1, roundPoints: 8, blockWins: 1, blockPoints: 104 },
  { pos: 4, name: 'Anders', roundWins: 1, roundPoints: 7, blockWins: 0, blockPoints: 88 },
  { pos: 5, name: 'Mette', roundWins: 0, roundPoints: 5, blockWins: 0, blockPoints: 71 },
  { pos: 6, name: 'Jens "DNF"', roundWins: 0, roundPoints: 2, blockWins: 0, blockPoints: 49 },
] as const

const CHAT_MESSAGES = [
  { avatar: 'N', avatarBg: '#B8963E', avatarFg: '#F2EDE4', name: 'Nikolaj', time: 'for 8 min siden', body: 'Hvordan tog du Pogačar som joker?? Det var en risk' },
  { avatar: 'S', avatarBg: '#2C4A3E', avatarFg: '#F2EDE4', name: 'Stæhr', time: 'for 4 min siden', body: 'Han har vundet 4 i træk, jeg gambler 😎' },
] as const

function Step4Spilrum({ race, onClose }: { race: Race; onClose: () => void }) {
  return (
    <>
      {/* Hero strip */}
      <div
        className="px-4 sm:px-5 pt-5 sm:pt-6 pb-6 sm:pb-7 text-cream"
        style={{ background: '#1a3329', fontFamily: "'Barlow', sans-serif" }}
      >
        <div className="max-w-[680px] mx-auto">
          <div className="flex items-start justify-between gap-2 sm:gap-3 mb-4 sm:mb-5">
            <div className="min-w-0 flex-1">
              <h1
                id="cycling-demo-heading"
                className="font-condensed font-bold leading-tight text-[20px] sm:text-[24px]"
                style={{ fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '-0.01em' }}
              >
                {race.name === "Giro d'Italia" ? 'Giro champs' : `${race.name.split(' ')[0]} liga`}
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
              className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 rounded-sm flex-shrink-0"
              style={{ background: 'rgba(242,237,228,0.1)', border: '1px solid rgba(242,237,228,0.2)' }}
            >
              <span
                className="hidden sm:inline"
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
                  fontSize: 12,
                  fontWeight: 700,
                  color: '#B8963E',
                  letterSpacing: '0.08em',
                  whiteSpace: 'nowrap',
                }}
              >
                BDG-CYC4
              </span>
            </div>
          </div>

          <div className="grid grid-cols-4 pt-3 sm:pt-3.5" style={{ borderTop: '1px solid rgba(242,237,228,0.15)' }}>
            {[
              { label: 'Deltagere', value: '6', gold: false },
              { label: 'Etaper', value: race.type === 'one_day' ? '1' : '21', gold: false },
              { label: 'Placering', value: '#1', gold: false },
              { label: 'Dine point', value: '142', gold: true },
            ].map((stat, i) => (
              <div
                key={stat.label}
                className={(i > 0 ? 'pl-1.5 sm:pl-2.5 ' : '') + (i < 3 ? 'pr-1.5 sm:pr-2.5 ' : '')}
                style={{ borderRight: i < 3 ? '1px solid rgba(242,237,228,0.15)' : 'none' }}
              >
                <p
                  style={{
                    fontFamily: "'Barlow Condensed', sans-serif",
                    fontSize: 9,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    color: 'rgba(242,237,228,0.5)',
                    marginBottom: 4,
                  }}
                >
                  {stat.label}
                </p>
                <p
                  className="text-[18px] sm:text-[20px]"
                  style={{
                    fontFamily: "'Barlow Condensed', sans-serif",
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

      {/* Content */}
      <div className="px-4 sm:px-6 py-6">
        <div className="max-w-[680px] mx-auto space-y-5">
          {/* Leaderboard */}
          <div>
            <span
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: '0.12em', color: '#9E9486',
              }}
            >
              Leaderboard
            </span>
            <div
              className="mt-2 rounded-sm overflow-hidden"
              style={{ background: '#FDFAF5', border: '1px solid #E8E0D3' }}
            >
              <div
                className="grid items-center"
                style={{
                  gridTemplateColumns: '28px 1fr 44px 52px 44px 52px',
                  padding: '8px 10px',
                  borderBottom: '1px solid #E8E0D3',
                  gap: 4,
                }}
              >
                {['#', '', 'E. sejr', 'E. point', 'L. sejr', 'L. point'].map((h, i) => (
                  <span
                    key={i}
                    style={{
                      fontFamily: "'Barlow Condensed', sans-serif",
                      fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
                      letterSpacing: '0.08em', color: '#9E9486',
                      textAlign: i >= 2 ? 'right' : 'left',
                    }}
                  >
                    {h}
                  </span>
                ))}
              </div>
              {LEADERBOARD.map((row, idx) => {
                const rankColor = idx === 0 ? '#B8963E' : idx === 1 ? '#7A7A7A' : idx === 2 ? '#A0785A' : '#9E9486'
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
                    <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, fontWeight: 700, color: rankColor }}>
                      {row.pos}
                    </span>
                    <span
                      style={{
                        fontFamily: "'Barlow Condensed', sans-serif",
                        fontSize: 13, fontWeight: isUser ? 700 : 600,
                        color: isUser ? '#1a3329' : '#1a1a1a',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
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

          {/* Thread */}
          <div>
            <span
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: '0.12em', color: '#9E9486',
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
                      width: 32, height: 32,
                      background: msg.avatarBg, color: msg.avatarFg,
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

// ─── Footer nav ─────────────────────────────────────────────────────────────

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
  const nextLabel = step === 1 ? 'Næste →' : step === 2 ? 'Se resultatet →' : 'Se spilrummet →'

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

// ─── Animations ────────────────────────────────────────────────────────────

function DemoStyles({ reducedMotion }: { reducedMotion: boolean }) {
  if (reducedMotion) {
    return (
      <style>{`
        .cyc-modal-entering, .cyc-modal-exiting,
        .cyc-step-anim, .cyc-result-reveal { animation: none !important; }
      `}</style>
    )
  }
  return (
    <style>{`
      @keyframes cyc-modal-in {
        from { opacity: 0; transform: scale(0.96); }
        to   { opacity: 1; transform: scale(1); }
      }
      @keyframes cyc-modal-out {
        from { opacity: 1; transform: scale(1); }
        to   { opacity: 0; transform: scale(0.98); }
      }
      @keyframes cyc-step-in {
        from { opacity: 0; transform: translateY(8px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      @keyframes cyc-result-reveal {
        from { opacity: 0; transform: translateY(4px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      @keyframes cyc-sheet-in {
        from { opacity: 0; transform: translateY(20px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      .cyc-modal-entering { animation: cyc-modal-in 250ms ease-out both; }
      .cyc-modal-exiting  { animation: cyc-modal-out 200ms ease-in both; }
      .cyc-step-anim       { animation: cyc-step-in 200ms ease-out both; }
      .cyc-result-reveal   { animation: cyc-result-reveal 400ms ease-out both; }
    `}</style>
  )
}
