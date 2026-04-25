'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

type Race = {
  id: string
  name: string
  pcs_slug: string
  race_type: string
  profile: string | null
  start_date: string
  end_date: string | null
  status: string
}

type Props = {
  gameId: number
  races: Race[]
}

const FLANDERN_SLUGS = new Set([
  'omloop-het-nieuwsblad', 'strade-bianche', 'milano-sanremo',
  'e3-harelbeke', 'gent-wevelgem', 'dwars-door-vlaanderen', 'ronde-van-vlaanderen',
])

const ARDENNERNE_SLUGS = new Set([
  'paris-roubaix', 'amstel-gold-race', 'la-fleche-wallonne', 'liege-bastogne-liege',
])

function blockNumberFor(race: Race): number {
  if (FLANDERN_SLUGS.has(race.pcs_slug)) return 1
  if (ARDENNERNE_SLUGS.has(race.pcs_slug)) return 2
  // Stage races + øvrige one-day: brug start måned som approximation
  const month = new Date(race.start_date).getMonth() + 1
  if (month <= 4) return 3
  if (month <= 6) return 4
  if (month <= 8) return 5
  if (month <= 10) return 6
  return 7
}

export default function AddRacesForm({ gameId, races }: Props) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const upcomingRaces = useMemo(
    () => races.filter((r) => r.status !== 'finished'),
    [races],
  )
  const finishedRaces = useMemo(
    () => races.filter((r) => r.status === 'finished'),
    [races],
  )

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleSubmit() {
    if (selected.size === 0) {
      setError('Vælg mindst ét løb')
      return
    }
    setSubmitting(true)
    setError(null)

    const race_selections = Array.from(selected).map((race_id) => {
      const race = races.find((r) => r.id === race_id)!
      return { race_id, block_number: blockNumberFor(race) }
    })

    try {
      const res = await fetch(`/api/games/${gameId}/cycling/add-races`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ race_selections }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Kunne ikke tilføje løb')
        setSubmitting(false)
        return
      }
      router.push(`/games/${gameId}`)
    } catch {
      setError('Netværksfejl')
      setSubmitting(false)
    }
  }

  if (races.length === 0) {
    return (
      <div className="rounded-sm border border-black/10 bg-white p-6 text-center font-body text-text-warm">
        Alle løb i 2026-sæsonen er allerede tilknyttet dette spilrum.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <RaceList
        title="Kommende løb"
        races={upcomingRaces}
        selected={selected}
        onToggle={toggle}
      />
      {finishedRaces.length > 0 && (
        <RaceList
          title="Allerede kørte løb"
          subtitle="Disse kan ikke tilføjes — vises kun for at give overblik over sæsonen."
          races={finishedRaces}
          selected={selected}
          onToggle={toggle}
          disabled
        />
      )}

      {error && (
        <div className="rounded-sm border border-red-300 bg-red-50 p-3 font-body text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex justify-between items-center pt-4 border-t border-black/10">
        <span className="font-condensed text-sm text-text-warm">
          {selected.size} løb valgt
        </span>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting || selected.size === 0}
          className="px-6 py-3 rounded-sm font-condensed font-bold text-sm uppercase tracking-[0.08em] bg-forest text-cream hover:bg-forest/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {submitting ? 'Tilføjer...' : `Tilføj ${selected.size > 0 ? selected.size : ''} løb`}
        </button>
      </div>
    </div>
  )
}

function RaceList({
  title, subtitle, races, selected, onToggle, disabled = false,
}: {
  title: string
  subtitle?: string
  races: Race[]
  selected: Set<string>
  onToggle: (id: string) => void
  disabled?: boolean
}) {
  if (races.length === 0) return null
  return (
    <div>
      <h2 className="font-condensed text-xs uppercase tracking-[0.14em] text-text-warm mb-1">
        {title}
      </h2>
      {subtitle && (
        <p className="font-body text-xs text-text-warm/70 mb-3">{subtitle}</p>
      )}
      <div className={`rounded-sm border border-black/10 bg-white overflow-hidden ${disabled ? 'opacity-60' : ''}`}>
        {races.map((race, idx) => {
          const isSelected = !disabled && selected.has(race.id)
          const isFinished = race.status === 'finished'
          const Wrapper: React.ElementType = disabled ? 'div' : 'button'
          return (
            <Wrapper
              key={race.id}
              {...(disabled ? {} : { type: 'button' as const, onClick: () => onToggle(race.id) })}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                idx > 0 ? 'border-t border-black/5' : ''
              } ${disabled ? 'cursor-not-allowed' : isSelected ? 'bg-forest/5' : 'hover:bg-black/2'}`}
            >
              <div className={`w-5 h-5 rounded-sm border-2 flex items-center justify-center flex-shrink-0 ${
                disabled ? 'border-black/15 bg-black/5' : isSelected ? 'bg-forest border-forest' : 'border-black/30'
              }`}>
                {isSelected && (
                  <svg className="w-3 h-3 text-cream" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-condensed font-bold text-base text-forest truncate">
                  {race.name}
                </div>
                <div className="font-body text-xs text-text-warm">
                  {new Date(race.start_date).toLocaleDateString('da-DK', { day: 'numeric', month: 'long' })}
                  {race.end_date && race.end_date !== race.start_date && (
                    <> – {new Date(race.end_date).toLocaleDateString('da-DK', { day: 'numeric', month: 'long' })}</>
                  )}
                  {race.race_type === 'stage_race' && <> · etapeløb</>}
                  {isFinished && <> · <span className="text-text-warm/60">færdigt</span></>}
                </div>
              </div>
            </Wrapper>
          )
        })}
      </div>
    </div>
  )
}
