'use client'

import { useState, useEffect, useMemo } from 'react'
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

type RoleKey = 'captain' | 'solo_attack' | 'sprint_assist' | 'domestique' | 'helper_0' | 'helper_1' | 'helper_2' | 'luxury_helper'

type LineupState = Record<string, Record<RoleKey, string | null>>

type Props = {
  gameId: number
  squadId: string | null
  activeBlock: ActiveBlock | null
  races: Race[]
  squadRiders: SquadRider[]
}

// ── Constants ───────────────────────────────────────────────────────────────

const ROLES: { key: RoleKey; label: string; emoji: string }[] = [
  { key: 'captain',        label: 'Kaptajn',      emoji: '🏆' },
  { key: 'solo_attack',    label: 'Solo',          emoji: '⚔️' },
  { key: 'sprint_assist',  label: 'Sprint',        emoji: '💨' },
  { key: 'domestique',     label: 'Domestik',      emoji: '🐴' },
  { key: 'helper_0',       label: 'Hjælper',       emoji: '🤝' },
  { key: 'helper_1',       label: 'Hjælper',       emoji: '🤝' },
  { key: 'helper_2',       label: 'Hjælper',       emoji: '🤝' },
  { key: 'luxury_helper',  label: 'Luksus',        emoji: '🛡️' },
]

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

function formatRaceDate(dateStr: string): string {
  const months = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']
  const d = new Date(dateStr)
  return `${d.getDate()}. ${months[d.getMonth()]}`
}

function shortName(name: string): string {
  return SHORT_NAMES[name] ?? name
}

// ── Component ───────────────────────────────────────────────────────────────

export default function CyclingGameroom({ gameId, squadId, activeBlock, races, squadRiders }: Props) {
  const [lineups, setLineups] = useState<LineupState>({})
  const [loadingLineups, setLoadingLineups] = useState(true)

  const riderMap = useMemo(() => {
    const map = new Map<string, SquadRider>()
    for (const r of squadRiders) map.set(r.id, r)
    return map
  }, [squadRiders])

  // Fetch existing lineups
  useEffect(() => {
    if (!squadId) { setLoadingLineups(false); return }
    fetch(`/api/cycling-games/${gameId}/lineup`)
      .then((res) => res.json())
      .then((data) => {
        if (!data.lineups?.length) { setLoadingLineups(false); return }
        const state: LineupState = {}
        for (const lineup of data.lineups) {
          const raceSlots: Record<RoleKey, string | null> = {
            captain: null, solo_attack: null, sprint_assist: null, domestique: null,
            helper_0: null, helper_1: null, helper_2: null, luxury_helper: null,
          }
          for (const rider of lineup.riders) {
            let roleKey: RoleKey = rider.role as RoleKey
            if (rider.role === 'helper') {
              roleKey = `helper_${rider.slot_index}` as RoleKey
            }
            if (roleKey in raceSlots) {
              raceSlots[roleKey] = rider.rider_id
            }
          }
          state[lineup.race_id] = raceSlots
        }
        setLineups(state)
        setLoadingLineups(false)
      })
      .catch(() => setLoadingLineups(false))
  }, [gameId, squadId])

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

  function getLineupCount(raceId: string): number {
    const lineup = lineups[raceId]
    if (!lineup) return 0
    return Object.values(lineup).filter((v) => v !== null).length
  }

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

      {/* ── Løb-kort ──────────────────────────────────────────────── */}
      {races.map((race) => {
        const lineup = lineups[race.id]
        const filledCount = getLineupCount(race.id)
        const hasLineup = filledCount > 0
        const raceTypeLabel = race.race_type === 'stage_race' ? 'Etapeløb' : 'Endagsløb'

        return (
          <div
            key={race.id}
            style={{
              background: '#FDFAF5',
              border: '1px solid #E8E0D3',
              borderRadius: 2,
              padding: '14px 16px',
            }}
          >
            {/* Race header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
              <div>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, fontWeight: 700, color: '#1a1a1a', lineHeight: 1.2 }}>
                  {race.name}
                </div>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, color: '#9E9486', marginTop: 2 }}>
                  {formatRaceDate(race.start_date)} · {raceTypeLabel}
                </div>
              </div>
              <span style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                fontSize: 10,
                fontWeight: 700,
                color: hasLineup ? '#085041' : '#9E9486',
                padding: '2px 6px',
                borderRadius: 2,
                background: hasLineup ? '#E1F5EE' : '#F2EDE4',
              }}>
                {filledCount}/8
              </span>
            </div>

            {/* Role pills */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 12 }}>
              {ROLES.map((role) => {
                const riderId = lineup?.[role.key] ?? null
                const rider = riderId ? riderMap.get(riderId) : null

                if (rider) {
                  return (
                    <span
                      key={role.key}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 3,
                        padding: '3px 8px',
                        borderRadius: 999,
                        background: '#E6F1FB',
                        color: '#0C447C',
                        fontFamily: "'Barlow Condensed', sans-serif",
                        fontSize: 11,
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {rider.last_name}
                    </span>
                  )
                }

                return (
                  <span
                    key={role.key}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 3,
                      padding: '3px 8px',
                      borderRadius: 999,
                      background: '#F2EDE4',
                      color: '#9E9486',
                      fontFamily: "'Barlow Condensed', sans-serif",
                      fontSize: 11,
                      fontWeight: 500,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <span style={{ fontSize: 10 }}>{role.emoji}</span>
                    {role.label}
                  </span>
                )
              })}
            </div>

            {/* Action button — scrolls to LineupBuilder */}
            <a
              href={`#lineup-${race.id}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '8px 16px',
                borderRadius: 2,
                background: hasLineup ? 'transparent' : '#1E3A5F',
                border: hasLineup ? '1px solid #D4CFC4' : '1px solid #1E3A5F',
                color: hasLineup ? '#1a1a1a' : '#F2EDE4',
                fontFamily: "'Barlow Condensed', sans-serif",
                fontSize: 12,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                textDecoration: 'none',
                cursor: 'pointer',
              }}
            >
              {hasLineup ? 'Rediger' : 'Sæt lineup'} →
            </a>
          </div>
        )
      })}

      {races.length === 0 && (
        <div style={{
          padding: '32px 16px',
          textAlign: 'center',
          border: '1px dashed #C8BEA8',
          borderRadius: 2,
          color: '#9E9486',
          fontFamily: "'Barlow', sans-serif",
          fontSize: 13,
        }}>
          Ingen aktive løb i denne blok
        </div>
      )}
    </div>
  )
}
