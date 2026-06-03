'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import CyclingBlocksPreview from '@/components/cycling/CyclingBlocksPreview'

type Race = {
  id: string
  name: string
  pcs_slug: string
  race_type: string
  profile: string
  start_date: string | null
}

type Props = {
  races: Race[]
}

// ── Block definitions ────────────────────────────────────────────────────────

const MONUMENT_SLUGS = [
  'milano-sanremo', 'ronde-van-vlaanderen', 'paris-roubaix',
  'liege-bastogne-liege', 'il-lombardia',
]

const FLANDERN_SLUGS = [
  'omloop-het-nieuwsblad', 'strade-bianche', 'milano-sanremo',
  'e3-harelbeke', 'gent-wevelgem', 'dwars-door-vlaanderen',
  'ronde-van-vlaanderen',
]

const ARDENNERNE_SLUGS = [
  'paris-roubaix', 'amstel-gold-race', 'la-fleche-wallonne',
  'liege-bastogne-liege',
]

const GRAND_TOUR_SLUGS = ['giro-d-italia', 'tour-de-france', 'vuelta-a-espana']

const MAJOR_TOUR_SLUGS = [
  'paris-nice', 'tirreno-adriatico', 'volta-a-catalunya',
  'itzulia-basque-country', 'tour-de-romandie', 'dauphine',
  'tour-de-suisse',
]

const CHAMPIONSHIP_SLUGS = ['world-championship', 'uec-road-european-championships']

const OTHER_SLUGS = [
  'il-lombardia', 'eschborn-frankfurt', 'san-sebastian',
  'bretagne-classic', 'gp-quebec', 'gp-montreal',
]

type BlockDef = {
  key: string
  label: string
  desc: string
  icon: string
  slugs: string[]
  blockNumber: number
}

const BLOCKS: BlockDef[] = [
  {
    key: 'flandern',
    label: 'Flandern-klassikerne',
    desc: '7 forårsklassikere fra Omloop til Ronde',
    icon: '🧱',
    slugs: FLANDERN_SLUGS,

    blockNumber: 1,
  },
  {
    key: 'ardennerne',
    label: 'Ardennerne-klassikerne',
    desc: 'Paris-Roubaix, Amstel, Flèche og Liège',
    icon: '⛰️',
    slugs: ARDENNERNE_SLUGS,

    blockNumber: 2,
  },
  {
    key: 'grand-tours',
    label: 'Grand Tours',
    desc: 'De tre store etapeløb',
    icon: '🏔️',
    slugs: GRAND_TOUR_SLUGS,

    blockNumber: 3,
  },
  {
    key: 'major-tours',
    label: 'Major Tours',
    desc: 'Ugelange etapeløb gennem sæsonen',
    icon: '🗺️',
    slugs: MAJOR_TOUR_SLUGS,

    blockNumber: 4,
  },
  {
    key: 'championships',
    label: 'Mesterskaber',
    desc: 'VM og EM på landevej',
    icon: '🏅',
    slugs: CHAMPIONSHIP_SLUGS,

    blockNumber: 5,
  },
  {
    key: 'other',
    label: 'Øvrige klassikere',
    desc: 'Lombardiet, Eschborn-Frankfurt og efterårsløb',
    icon: '🍂',
    slugs: OTHER_SLUGS,

    blockNumber: 6,
  },
]

// ── Helpers ──────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  )
}

function StepNumber({ n, active }: { n: number; active: boolean }) {
  return (
    <div className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center font-condensed font-semibold text-sm mt-0.5 transition-colors ${
      active ? 'bg-forest text-cream' : 'bg-border text-text-warm'
    }`}>
      {n}
    </div>
  )
}

function Connector() {
  return <div className="w-px h-6 bg-border ml-[13px]" />
}

// ── Season Calendar ─────────────────────────────────────────────────────────

const CAT_COLORS: Record<string, { bg: string; color: string }> = {
  flandern:    { bg: '#B5D4F4', color: '#0C447C' },
  ardennerne:  { bg: '#9FE1CB', color: '#085041' },
  grandTour:   { bg: '#FAC775', color: '#633806' },
  majorTour:   { bg: '#F5C4B3', color: '#712B13' },
  other:       { bg: '#C0DD97', color: '#27500A' },
}

function getRaceCategory(slug: string): { bg: string; color: string } {
  if (FLANDERN_SLUGS.includes(slug)) return CAT_COLORS.flandern
  if (ARDENNERNE_SLUGS.includes(slug)) return CAT_COLORS.ardennerne
  if (GRAND_TOUR_SLUGS.includes(slug)) return CAT_COLORS.grandTour
  if (MAJOR_TOUR_SLUGS.includes(slug)) return CAT_COLORS.majorTour
  return CAT_COLORS.other
}

const MONTH_NAMES = ['Januar', 'Februar', 'Marts', 'April', 'Maj', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'December']
const QUARTER_LABELS = [
  'Q1 — Jan · Feb · Mar',
  'Q2 — Apr · Maj · Jun',
  'Q3 — Jul · Aug · Sep',
  'Q4 — Okt · Nov · Dec',
]

function SeasonCalendar({ races, selectedRaceIds }: { races: Race[]; selectedRaceIds: Set<string> }) {
  const [quarter, setQuarter] = useState(0)

  const racesByMonth = useMemo(() => {
    const map: Record<number, Race[]> = {}
    for (let i = 0; i < 12; i++) map[i] = []
    for (const r of races) {
      if (!r.start_date) continue
      const month = new Date(r.start_date).getMonth()
      map[month].push(r)
    }
    // Sort each month by date
    for (const key in map) {
      map[key].sort((a, b) => (a.start_date ?? '').localeCompare(b.start_date ?? ''))
    }
    return map
  }, [races])

  const startMonth = quarter * 3
  const months = [startMonth, startMonth + 1, startMonth + 2]

  return (
    <div style={{ marginTop: 16, marginBottom: 8 }}>
      <div style={{ marginBottom: 12 }}>
        <span
          style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: 11,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: '#6b6b6b',
          }}
        >
          Sæsonoverblik 2026
        </span>
      </div>

      <div
        style={{
          background: '#fff',
          border: '1px solid #D4CFC4',
          borderRadius: 2,
          overflow: 'hidden',
        }}
      >
        {/* Quarter label */}
        <div
          style={{
            padding: '10px 14px',
            borderBottom: '1px solid #EDE8E0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: 12,
              fontWeight: 600,
              color: '#1a1a1a',
              letterSpacing: '0.04em',
            }}
          >
            {QUARTER_LABELS[quarter]}
          </span>
        </div>

        {/* 3 months side by side */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', minHeight: 160 }}>
          {months.map((m) => {
            const monthRaces = racesByMonth[m] ?? []
            return (
              <div
                key={m}
                style={{
                  borderRight: m < startMonth + 2 ? '1px solid #EDE8E0' : 'none',
                  padding: '8px 6px',
                }}
              >
                {/* Month header */}
                <div
                  style={{
                    fontFamily: "'Barlow Condensed', sans-serif",
                    fontSize: 10,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    color: '#9E9486',
                    marginBottom: 6,
                    textAlign: 'center',
                  }}
                >
                  {MONTH_NAMES[m]}
                </div>

                {monthRaces.length === 0 ? (
                  <div
                    style={{
                      fontFamily: "'Barlow', sans-serif",
                      fontSize: 10,
                      color: '#C0B8B0',
                      textAlign: 'center',
                      padding: '12px 0',
                    }}
                  >
                    Ingen løb
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {monthRaces.map((race) => {
                      const cat = getRaceCategory(race.pcs_slug)
                      const isSelected = selectedRaceIds.has(race.id)
                      const d = race.start_date ? new Date(race.start_date) : null
                      const dayLabel = d
                        ? `${d.getDate()}. ${MONTH_NAMES[d.getMonth()].slice(0, 3).toLowerCase()}`
                        : ''

                      return (
                        <div
                          key={race.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            padding: '3px 5px',
                            borderRadius: 2,
                            background: cat.bg,
                            border: isSelected ? `2px solid ${cat.color}` : '2px solid transparent',
                            opacity: isSelected ? 1 : 0.7,
                          }}
                        >
                          <span
                            style={{
                              fontFamily: "'Barlow Condensed', sans-serif",
                              fontSize: 9,
                              fontWeight: 600,
                              color: cat.color,
                              whiteSpace: 'nowrap',
                              flexShrink: 0,
                            }}
                          >
                            {dayLabel}
                          </span>
                          <span
                            style={{
                              fontFamily: "'Barlow Condensed', sans-serif",
                              fontSize: 9,
                              fontWeight: isSelected ? 700 : 500,
                              color: cat.color,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {race.name}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Dot navigation + slider */}
        <div
          style={{
            padding: '10px 16px 12px',
            borderTop: '1px solid #EDE8E0',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 8,
          }}
        >
          {/* Dots */}
          <div style={{ display: 'flex', gap: 6 }}>
            {[0, 1, 2, 3].map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => setQuarter(q)}
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  border: 'none',
                  background: q === quarter ? '#2C4A3E' : '#D4CFC4',
                  cursor: 'pointer',
                  padding: 0,
                  transition: 'background 0.15s',
                }}
              />
            ))}
          </div>

          {/* Range slider */}
          <input
            type="range"
            min={0}
            max={3}
            step={1}
            value={quarter}
            onChange={(e) => setQuarter(parseInt(e.target.value))}
            style={{
              width: '100%',
              maxWidth: 200,
              accentColor: '#2C4A3E',
              cursor: 'pointer',
            }}
          />
        </div>
      </div>
    </div>
  )
}

// ── Component ────────────────────────────────────────────────────────────────

export default function NewCyclingGameForm({ races }: Props) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [selectedRaceIds, setSelectedRaceIds] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  // Build slug → race lookup
  const raceBySlug: Record<string, Race> = {}
  for (const r of races) {
    raceBySlug[r.pcs_slug] = r
  }

  // Race er "finished" hvis start_date er mere end 2 dage i fortiden
  const twoDaysAgo = new Date()
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2)

  function isRaceFinished(race: Race): boolean {
    if (!race.start_date) return false
    return new Date(race.start_date) < twoDaysAgo
  }

  function isBlockFinished(block: BlockDef): boolean {
    const blockRaces = block.slugs.map((s) => raceBySlug[s]).filter((r): r is Race => !!r)
    if (blockRaces.length === 0) return false
    return blockRaces.every((r) => isRaceFinished(r))
  }

  const step2Active = name.trim().length >= 2
  const step3Active = step2Active && selectedRaceIds.size > 0
  const canSubmit = name.trim().length >= 2 && selectedRaceIds.size > 0

  function toggleBundle(block: BlockDef) {
    const blockRaceIds = block.slugs
      .map((s) => raceBySlug[s]?.id)
      .filter((id): id is string => !!id)

    setSelectedRaceIds((prev) => {
      const next = new Set(prev)
      const allSelected = blockRaceIds.every((id) => next.has(id))
      if (allSelected) {
        for (const id of blockRaceIds) next.delete(id)
      } else {
        for (const id of blockRaceIds) next.add(id)
      }
      return next
    })
  }

  function toggleRace(raceId: string) {
    setSelectedRaceIds((prev) => {
      const next = new Set(prev)
      if (next.has(raceId)) next.delete(raceId)
      else next.add(raceId)
      return next
    })
  }

  function isBlockFullySelected(block: BlockDef): boolean {
    const blockRaces = block.slugs.map((s) => raceBySlug[s]).filter(Boolean)
    if (blockRaces.length === 0) return false
    return blockRaces.every((race) => selectedRaceIds.has(race.id))
  }

  function isBlockPartiallySelected(block: BlockDef): boolean {
    return block.slugs.some((s) => {
      const race = raceBySlug[s]
      return race && selectedRaceIds.has(race.id)
    })
  }

  // Build the race_selections for the API: { race_id, block_number }[]
  function buildRaceSelections(): { race_id: string; block_number: number }[] {
    const selections: { race_id: string; block_number: number }[] = []
    const seen = new Set<string>()
    for (const block of BLOCKS) {
      for (const slug of block.slugs) {
        const race = raceBySlug[slug]
        if (race && selectedRaceIds.has(race.id) && !seen.has(race.id)) {
          seen.add(race.id)
          selections.push({ race_id: race.id, block_number: block.blockNumber })
        }
      }
    }
    return selections
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (name.trim().length < 2) { setError('Spilnavn skal være mindst 2 tegn'); return }
    if (selectedRaceIds.size === 0) { setError('Vælg mindst ét løb'); return }

    setCreating(true)

    try {
      const res = await fetch('/api/games/cycling-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          race_selections: buildRaceSelections(),
        }),
      })
      const data = await res.json()

      if (!res.ok) { setError(data.error ?? 'Noget gik galt'); setCreating(false); return }

      router.push(`/games/${data.game_id}`)
    } catch {
      setError('Noget gik galt')
      setCreating(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="flex flex-col">

        {/* ── Trin 1: Navn ─────────────────────────────────── */}
        <div className="flex gap-5">
          <StepNumber n={1} active={true} />
          <div className="flex-1 pb-2">
            <p className="font-condensed text-[10px] uppercase tracking-[0.12em] text-text-warm mb-1">Trin 1</p>
            <p className="font-condensed font-semibold text-lg text-primary mb-4">Hvad skal spilrummet hedde?</p>
            <div className="relative">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Fx. Tour-holdet 2026"
                maxLength={60}
                className="w-full bg-white border border-border rounded-sm px-4 py-3.5 font-body text-sm text-primary placeholder:text-text-warm outline-none focus:border-forest transition-colors"
              />
              <span className="absolute right-3 bottom-2.5 text-[11px] font-condensed text-border">
                {name.length}/60
              </span>
            </div>
          </div>
        </div>

        <Connector />

        {/* ── Trin 2: Vælg blocks/løb ──────────────────────── */}
        <div className="flex gap-5">
          <StepNumber n={2} active={step2Active} />
          <div className="flex-1 pb-2">
            <p className="font-condensed text-[10px] uppercase tracking-[0.12em] text-text-warm mb-1">Trin 2</p>
            <p className="font-condensed font-semibold text-lg text-primary mb-1">Vælg løb</p>
            <p className="font-body text-xs text-text-warm font-light leading-relaxed mb-4">
              Vælg hvilke løb der skal indgå i spilrummet. Minimum ét løb.
            </p>

            <div className="space-y-4">
              {BLOCKS.map((block) => {
                const blockRaces = block.slugs
                  .map((s) => raceBySlug[s])
                  .filter((r): r is Race => !!r)
                const fullySelected = isBlockFullySelected(block)
                const partiallySelected = isBlockPartiallySelected(block)
                const blockFinished = isBlockFinished(block)

                return (
                  <div
                    key={block.key}
                    className={`border-[1.5px] transition-all ${
                      fullySelected
                        ? 'border-forest bg-cream-dark'
                        : partiallySelected
                          ? 'border-forest/40 bg-cream'
                          : 'border-border bg-white'
                    }`}
                    style={{
                      borderRadius: '2px',
                      ...(blockFinished
                        ? { opacity: 0.4, pointerEvents: 'none' as const }
                        : {}),
                    }}
                  >
                    {/* Block header */}
                    <button
                      type="button"
                      onClick={() => toggleBundle(block)}
                      className="w-full px-4 py-3.5 flex items-center gap-3 text-left"
                    >
                      <span className="text-xl leading-none">{block.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-condensed font-semibold text-sm text-primary">
                            {block.label}
                          </span>
                          <span className="font-condensed text-[10px] text-text-warm uppercase tracking-wide">
                            {blockRaces.length} løb
                          </span>
                        </div>
                        <p className="font-body text-xs text-text-warm font-light leading-snug mt-0.5">
                          {block.desc}
                        </p>
                      </div>
                      <span className={`w-5 h-5 rounded-sm border-[1.5px] flex items-center justify-center shrink-0 transition-colors ${
                        fullySelected
                          ? 'bg-forest border-forest text-cream'
                          : partiallySelected
                            ? 'bg-forest/20 border-forest text-forest'
                            : 'border-border'
                      }`}>
                        {fullySelected && <span className="text-xs font-bold">✓</span>}
                        {partiallySelected && !fullySelected && <span className="text-[10px] font-bold">–</span>}
                      </span>
                    </button>

                    {/* Individual races */}
                    {(fullySelected || partiallySelected) && (
                      <div className="border-t border-border/50 px-4 py-2 space-y-0.5">
                        {blockRaces.map((race) => {
                          const selected = selectedRaceIds.has(race.id)
                          const finished = isRaceFinished(race)
                          const isMonument = MONUMENT_SLUGS.includes(race.pcs_slug)
                          return (
                            <button
                              key={race.id}
                              type="button"
                              onClick={() => { if (!finished) toggleRace(race.id) }}
                              disabled={finished}
                              className="w-full flex items-center gap-3 py-1.5 text-left hover:bg-cream-dark/50 px-1 transition-colors"
                              style={{ borderRadius: '2px', opacity: finished ? 0.35 : 1, cursor: finished ? 'not-allowed' : 'pointer' }}
                            >
                              <span className={`w-4 h-4 rounded-sm border-[1.5px] flex items-center justify-center shrink-0 transition-colors ${
                                selected ? 'bg-forest border-forest text-cream' : 'border-border'
                              }`}>
                                {selected && <span className="text-[10px] font-bold">✓</span>}
                              </span>
                              <span className={`font-body text-[13px] ${selected ? 'text-primary' : 'text-text-warm'}`}>
                                {race.name}
                              </span>
                              {isMonument && (
                                <span style={{
                                  fontSize: 10, padding: '1px 5px', borderRadius: 999,
                                  background: '#FAC775', color: '#633806',
                                  fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
                                  whiteSpace: 'nowrap', flexShrink: 0,
                                }}>
                                  Monument
                                </span>
                              )}
                              {race.start_date && (
                                <span className="font-condensed text-[10px] text-text-warm ml-auto">
                                  {race.start_date}
                                </span>
                              )}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {selectedRaceIds.size > 0 && (
              <p className="font-condensed text-[11px] text-forest uppercase tracking-wide mt-3">
                {selectedRaceIds.size} løb valgt
              </p>
            )}
          </div>
        </div>

        {/* ── Sæsonkalender ────────────────────────────────── */}
        <SeasonCalendar races={races} selectedRaceIds={selectedRaceIds} />

        {/* ── Blok-forhåndsvisning ────────────────────────── */}
        {selectedRaceIds.size > 0 && (
          <div className="my-4">
            <CyclingBlocksPreview raceIds={[...selectedRaceIds]} />
          </div>
        )}

        <Connector />

        {/* ── Trin 3: Beskrivelse ───────────────────────────── */}
        <div className="flex gap-5">
          <StepNumber n={3} active={step3Active} />
          <div className="flex-1 pb-2">
            <p className="font-condensed text-[10px] uppercase tracking-[0.12em] text-text-warm mb-1">Trin 3 · Valgfrit</p>
            <p className="font-condensed font-semibold text-lg text-primary mb-4">Tilføj en beskrivelse</p>
            <div className="relative">
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Fx. fantasy-cykling med drengene..."
                maxLength={200}
                rows={3}
                className="w-full bg-white border border-border rounded-sm px-4 py-3.5 font-body text-sm text-primary placeholder:text-text-warm outline-none focus:border-forest transition-colors resize-none"
              />
              <span className="absolute right-3 bottom-2.5 text-[11px] font-condensed text-border">
                {description.length}/200
              </span>
            </div>
          </div>
        </div>

      </div>

      {/* ── Info-boks ───────────────────────────────────────── */}
      <div className="mt-10 bg-white border border-border rounded-sm px-5 py-4 space-y-2">
        {[
          'Du modtager en 6-tegns invitationskode',
          'Andre kan joine via koden fra deres dashboard',
          'Løb aktiveres automatisk når de starter',
        ].map((item) => (
          <div key={item} className="flex items-center gap-3 font-body text-sm text-text-warm">
            <span className="text-forest font-bold text-xs">✓</span>
            {item}
          </div>
        ))}
      </div>

      {/* ── Fejl ───────────────────────────────────────────── */}
      {error && (
        <div className="mt-4 bg-vintage-red/10 border border-vintage-red/30 text-vintage-red font-body text-sm rounded-sm px-4 py-3">
          {error}
        </div>
      )}

      {/* ── Knapper ────────────────────────────────────────── */}
      <div className="mt-10 flex gap-3">
        <Link
          href="/games/new"
          className="px-6 py-3.5 border border-border text-text-warm font-condensed text-sm uppercase tracking-widest rounded-sm hover:border-primary hover:text-primary transition-colors"
        >
          Tilbage
        </Link>
        <button
          type="submit"
          disabled={!canSubmit || creating}
          className="flex items-center gap-2 px-8 py-3.5 bg-forest text-cream font-condensed text-sm uppercase tracking-widest rounded-sm hover:opacity-85 disabled:opacity-40 transition-opacity"
        >
          {creating && <Spinner />}
          {creating ? 'Opretter...' : 'Opret Spilrum'}
        </button>
      </div>
    </form>
  )
}
