'use client'

import Link from 'next/link'

// ── Types ───────────────────────────────────────────────────────────────────

type Race = {
  id: string
  name: string
  start_date: string
  status: string
  race_type: string
}

type SquadRider = {
  id: string
  first_name: string
  last_name: string
  team_name: string
  category: number
  team_logo_url: string | null
  photo_url: string | null
}

type ActiveBlock = {
  id: string
  name: string
  block_order: number
  lock_deadline?: string | null
}

type Props = {
  gameId: number
  squadId: string | null
  activeBlock: ActiveBlock | null
  races: Race[]
  squadRiders: SquadRider[]
}

// ── Constants ───────────────────────────────────────────────────────────────

const SHORT_NAMES: Record<string, string> = {
  'Tour de France': 'Tour',
  "Giro d'Italia": 'Giro',
  'Vuelta a España': 'Vuelta',
  'Itzulia Basque Country': 'Itzulia',
  'Critérium du Dauphiné': 'Dauphiné',
  'Volta a Catalunya': 'Catalunya',
  'Tour de Romandie': 'Romandie',
  'Ronde van Vlaanderen': 'Flandern',
  'Omloop Het Nieuwsblad': 'Omloop',
  'Dwars door Vlaanderen': 'Dwars',
  'La Flèche Wallonne': 'Flèche',
  'Liège-Bastogne-Liège': 'Liège',
  'Amstel Gold Race': 'Amstel',
  'European Championships': 'EM',
  'World Championships': 'VM',
  'GP Québec': 'Québec',
  'GP Montréal': 'Montréal',
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatDeadline(iso: string): string {
  const d = new Date(iso)
  const months = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']
  const hours = String(d.getHours()).padStart(2, '0')
  const mins = String(d.getMinutes()).padStart(2, '0')
  return `${d.getDate()}. ${months[d.getMonth()]} kl. ${hours}:${mins}`
}

function shortName(name: string): string {
  return SHORT_NAMES[name] ?? name
}

// ── Component ───────────────────────────────────────────────────────────────

export default function CyclingGameroom({ gameId, squadId, activeBlock, races, squadRiders }: Props) {
  const hasSquad = !!squadId
  const raceNames = races.map((r) => shortName(r.name)).join(' · ')

  // ── Situation A: Ingen brutto trup ──────────────────────────────────────

  if (!hasSquad) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Link
          href={`/games/${gameId}/squad`}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px',
            background: '#FDFAF5',
            border: '1px solid #E8E0D3',
            borderRadius: 2,
            textDecoration: 'none',
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 15, fontWeight: 700, color: '#1a1a1a' }}>
                Sæt din trup
              </span>
              {activeBlock && (
                <span style={{
                  padding: '2px 8px',
                  borderRadius: 999,
                  background: '#E6F1FB',
                  color: '#0C447C',
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.02em',
                  whiteSpace: 'nowrap',
                }}>
                  {activeBlock.name}
                </span>
              )}
            </div>
            {raceNames && (
              <p style={{
                fontFamily: "'Barlow', sans-serif",
                fontSize: 12,
                color: '#9E9486',
                lineHeight: 1.4,
                marginBottom: 4,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical' as const,
              }}>
                {raceNames}
              </p>
            )}
            {activeBlock?.lock_deadline && (
              <p style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                fontSize: 11,
                color: '#C8392B',
                fontWeight: 600,
              }}>
                Låser {formatDeadline(activeBlock.lock_deadline)}
              </p>
            )}
          </div>
          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 22, color: '#1E3A5F', fontWeight: 700, marginLeft: 12, flexShrink: 0 }}>›</span>
        </Link>
      </div>
    )
  }

  // ── Situation B+C: Brutto trup udtaget ─────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── Brutto trup kort ──────────────────────────────────────── */}
      <Link
        href={`/games/${gameId}/squad`}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 16px',
          background: '#FDFAF5',
          border: '1px solid #E8E0D3',
          borderRadius: 2,
          textDecoration: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, fontWeight: 600, color: '#1a1a1a' }}>
            Din brutto trup
          </span>
          <span style={{
            padding: '2px 8px',
            borderRadius: 999,
            background: '#E1F5EE',
            color: '#085041',
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: 10,
            fontWeight: 700,
          }}>
            {squadRiders.length}/25 ryttere
          </span>
        </div>
        <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 18, color: '#1E3A5F', fontWeight: 700 }}>›</span>
      </Link>

      {/* ── Aktiv lineup label ────────────────────────────────────── */}
      {races.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: 11,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: '#6b6b6b',
          }}>
            Aktiv lineup
          </span>
          {activeBlock && (
            <span style={{
              padding: '2px 8px',
              borderRadius: 999,
              background: '#E6F1FB',
              color: '#0C447C',
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: 10,
              fontWeight: 700,
            }}>
              {activeBlock.name}
            </span>
          )}
          {activeBlock?.lock_deadline && (
            <span style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: 10,
              color: '#C8392B',
              fontWeight: 600,
              marginLeft: 'auto',
            }}>
              Låser {formatDeadline(activeBlock.lock_deadline)}
            </span>
          )}
        </div>
      )}

    </div>
  )
}
