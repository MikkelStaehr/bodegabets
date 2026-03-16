'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { League } from '@/types'

type Props = { leagues: League[] }
type SyncState = 'idle' | 'creating' | 'syncing' | 'done' | 'timeout'

const COUNTRY_FLAGS: Record<string, string> = {
  England: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', Germany: '🇩🇪', Spain: '🇪🇸', France: '🇫🇷',
  Italy: '🇮🇹', Netherlands: '🇳🇱', Turkey: '🇹🇷', Denmark: '🇩🇰',
  Europe: '🇪🇺', World: '🌍',
}

// Ligaer der anses som "topligaer" (bold_slug eller navn-match)
const TOP_LEAGUE_NAMES = [
  'Premier League', 'Bundesliga', 'La Liga', 'Serie A', 'Ligue 1', 'UEFA Champions League',
]

const EXTRA_BETS = [
  { icon: '⚽', name: 'Første målscorer', desc: 'Gæt hvem der scorer det første mål i kampen' },
  { icon: '🟨', name: 'Antal kort',       desc: 'Over eller under antal gule kort i kampen' },
  { icon: '⏱️', name: 'Overtid / tillægstid', desc: 'Kommer der mere end 4 minutters tillægstid?' },
  { icon: '🧤', name: 'Clean sheet',      desc: 'Holder hjemmeholdet nullet i anden halvleg?' },
]

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

export default function NewGameForm({ leagues }: Props) {
  const router = useRouter()
  const [name, setName]               = useState('')
  const [description, setDescription] = useState('')
  const [leagueId, setLeagueId]       = useState<string>('')
  const [error, setError]             = useState<string | null>(null)
  const [syncState, setSyncState]     = useState<SyncState>('idle')
  const [gameId, setGameId]           = useState<number | null>(null)
  const [pollAttempts, setPollAttempts] = useState(0)

  const loading    = syncState === 'creating' || syncState === 'syncing'
  const canSubmit  = name.trim().length >= 2 && leagueId !== ''
  const step2Active = name.trim().length >= 2
  const step3Active = step2Active && leagueId !== ''
  const step4Active = step3Active

  const topLeagues   = leagues.filter((l) => TOP_LEAGUE_NAMES.includes(l.name))
  const otherLeagues = leagues.filter((l) => !TOP_LEAGUE_NAMES.includes(l.name))

  const poll = async (id: number, attempt: number) => {
    if (attempt >= 10) { setSyncState('timeout'); return }
    try {
      const res  = await fetch(`/api/games/${id}/rounds`)
      const data = await res.json()
      if (data.count > 0) { setSyncState('done'); router.push(`/games/${id}`); return }
    } catch { /* ignore */ }
    setPollAttempts(attempt + 1)
    setTimeout(() => poll(id, attempt + 1), 2000)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (name.trim().length < 2) { setError('Spilnavn skal være mindst 2 tegn'); return }
    if (!leagueId)               { setError('Vælg en liga'); return }

    setSyncState('creating')

    const res  = await fetch('/api/games/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), league_id: parseInt(leagueId) }),
    })
    const data = await res.json()

    if (!res.ok) { setError(data.error ?? 'Noget gik galt'); setSyncState('idle'); return }

    const newGameId = data.game_id
    setGameId(newGameId)

    if (!data.warning) { setSyncState('done'); router.push(`/games/${newGameId}`); return }

    setSyncState('syncing')
    setPollAttempts(0)
    setTimeout(() => poll(newGameId, 0), 1000)
  }

  function LeagueGrid({ items }: { items: League[] }) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {items.map((l) => {
          const flag     = COUNTRY_FLAGS[l.country ?? ''] ?? '🏳️'
          const selected = leagueId === String(l.id)
          const hasSrc   = (l as League & { fixturedownload_slug?: string; bold_slug?: string }).fixturedownload_slug
                        || (l as League & { bold_slug?: string }).bold_slug
          const meta     = l.country ?? ''

          return (
            <button
              key={l.id}
              type="button"
              onClick={() => setLeagueId(String(l.id))}
              disabled={!hasSrc}
              className={`relative text-left p-3.5 border-[1.5px] rounded-sm transition-all flex flex-col gap-1.5 ${
                selected
                  ? 'border-forest bg-cream-dark'
                  : 'border-border bg-white hover:border-forest/50 hover:bg-cream'
              }`}
            >
              {selected && (
                <span className="absolute top-2 right-2.5 text-forest font-bold text-xs">✓</span>
              )}
              <span className="text-xl leading-none">{flag}</span>
              <span className="font-condensed font-semibold text-sm leading-snug text-primary">{l.name}</span>
              <span className="font-body text-xs text-text-warm font-light">{meta}</span>
            </button>
          )
        })}
      </div>
    )
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
                placeholder="Fx. VM 2026 – Drengene"
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

        {/* ── Trin 2: Liga ─────────────────────────────────── */}
        <div className="flex gap-5">
          <StepNumber n={2} active={step2Active} />
          <div className="flex-1 pb-2">
            <p className="font-condensed text-[10px] uppercase tracking-[0.12em] text-text-warm mb-1">Trin 2</p>
            <p className="font-condensed font-semibold text-lg text-primary mb-4">Vælg liga</p>

            {leagues.length === 0 ? (
              <p className="font-body text-sm text-text-warm">Ingen aktive ligaer — opret via admin-panelet.</p>
            ) : (
              <>
                <p className="font-condensed text-[10px] uppercase tracking-[0.12em] text-text-warm mb-2 flex items-center gap-2">
                  Topligaer
                  <span className="flex-1 h-px bg-border" />
                </p>
                <LeagueGrid items={topLeagues} />

                <p className="font-condensed text-[10px] uppercase tracking-[0.12em] text-text-warm mt-4 mb-2 flex items-center gap-2">
                  Øvrige
                  <span className="flex-1 h-px bg-border" />
                </p>
                <LeagueGrid items={otherLeagues} />
              </>
            )}
          </div>
        </div>

        <Connector />

        {/* ── Trin 3: Ekstra bets (placeholder) ───────────── */}
        <div className="flex gap-5">
          <StepNumber n={3} active={step3Active} />
          <div className="flex-1 pb-2">
            <p className="font-condensed text-[10px] uppercase tracking-[0.12em] text-text-warm mb-1">Trin 3 · Valgfrit</p>
            <p className="font-condensed font-semibold text-lg text-primary mb-1">Ekstra bets</p>
            <p className="font-body text-xs text-text-warm font-light leading-relaxed mb-4">
              Tilføj kampafgørende spørgsmål til hver runde — fx hvem scorer først, eller om der kommer overtid. Kommer snart.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {EXTRA_BETS.map((b) => (
                <div
                  key={b.name}
                  className="bg-cream-dark border border-border rounded-sm p-3.5 opacity-50 cursor-not-allowed flex flex-col gap-1"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-lg leading-none">{b.icon}</span>
                    <span className="font-condensed text-[10px] uppercase tracking-widest text-text-warm bg-cream-dark border border-border px-1.5 py-0.5 rounded-badge">
                      Kommer snart
                    </span>
                  </div>
                  <p className="font-condensed font-semibold text-sm text-primary">{b.name}</p>
                  <p className="font-body text-xs text-text-warm font-light leading-snug">{b.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <Connector />

        {/* ── Trin 4: Beskrivelse ───────────────────────────── */}
        <div className="flex gap-5">
          <StepNumber n={4} active={step4Active} />
          <div className="flex-1 pb-2">
            <p className="font-condensed text-[10px] uppercase tracking-[0.12em] text-text-warm mb-1">Trin 4 · Valgfrit</p>
            <p className="font-condensed font-semibold text-lg text-primary mb-4">Tilføj en beskrivelse</p>
            <div className="relative">
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Fx. kun for dem der så VM 1998 live..."
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
          'Du starter med 1.000 point',
          'Du modtager en 6-tegns invitationskode',
          'Andre kan joine via koden fra deres dashboard',
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

      {/* ── Syncing overlay ────────────────────────────────── */}
      {syncState === 'syncing' && (
        <div className="mt-6 border border-border bg-cream rounded-sm px-5 py-6 text-center space-y-3">
          <svg className="w-6 h-6 animate-spin text-forest mx-auto" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          <p className="font-condensed font-semibold text-sm uppercase tracking-[0.08em] text-primary">
            Henter kampprogram...
          </p>
          <p className="font-body text-text-warm text-xs">
            Dette tager et øjeblik{pollAttempts > 0 && ` (forsøg ${pollAttempts}/10)`}
          </p>
        </div>
      )}

      {/* ── Timeout ────────────────────────────────────────── */}
      {syncState === 'timeout' && gameId && (
        <div className="mt-6 border border-border bg-cream rounded-sm px-5 py-5 space-y-3">
          <p className="font-body text-text-warm text-sm">
            Synkroniseringen tog længere tid end forventet. Spilrummet er oprettet.
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => { setSyncState('syncing'); setPollAttempts(0); poll(gameId, 0) }}
              className="font-condensed font-semibold text-xs uppercase tracking-[0.08em] border border-forest text-forest px-4 py-2 rounded-sm hover:bg-forest hover:text-cream transition-colors"
            >
              Prøv igen
            </button>
            <button
              type="button"
              onClick={() => router.push(`/games/${gameId}`)}
              className="font-condensed font-semibold text-xs uppercase tracking-[0.08em] bg-forest text-cream px-4 py-2 rounded-sm hover:opacity-85 transition-opacity"
            >
              Gå til spilrum
            </button>
          </div>
        </div>
      )}

      {/* ── Knapper ────────────────────────────────────────── */}
      {(syncState === 'idle' || syncState === 'creating') && (
        <div className="mt-10 flex gap-3">
          <Link
            href="/dashboard"
            className="px-6 py-3.5 border border-border text-text-warm font-condensed text-sm uppercase tracking-widest rounded-sm hover:border-primary hover:text-primary transition-colors"
          >
            Annuller
          </Link>
          <button
            type="submit"
            disabled={!canSubmit || loading}
            className="flex items-center gap-2 px-8 py-3.5 bg-forest text-cream font-condensed text-sm uppercase tracking-widest rounded-sm hover:opacity-85 disabled:opacity-40 transition-opacity"
          >
            {syncState === 'creating' && <Spinner />}
            {syncState === 'creating' ? 'Opretter...' : 'Opret Spilrum'}
          </button>
        </div>
      )}
    </form>
  )
}
