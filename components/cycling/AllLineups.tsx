'use client'

import { useEffect, useState } from 'react'
import { Users, Eye, EyeOff } from 'lucide-react'
import TeamLogo from './TeamLogo'
import CatBadge from './CatBadge'
import { getTaunt, shouldTaunt } from '@/lib/zeroPointTaunt'

type RiderInLineup = {
  rider_id: string
  role: string
  slot_index: number
  first_name: string
  last_name: string
  team_name: string
  category: number
  team_logo_url: string | null
  photo_url: string | null
  points: number | null
}

type LineupEntry = {
  user_id: string
  username: string
  avatar_url: string | null
  total_points: number
  riders: RiderInLineup[]
}

type Props = {
  gameId: number
  stageId: string
  currentUserId: string
  /** Etape-profil — på 'ttt' vises rollerne neutralt som "Rytter". */
  profile?: string | null
}

const ROLE_ORDER = ['leader', 'lieutenant', 'grimpeur', 'sprinter', 'domestique', 'equipier', 'joker']

const ROLE_LABELS: Record<string, string> = {
  leader: 'Leader',
  lieutenant: 'Lieutenant',
  grimpeur: 'Grimpeur',
  sprinter: 'Sprinter',
  domestique: 'Domestique',
  equipier: 'Équipier',
  joker: 'Joker',
}
// Korte versioner brugt på narrow viewports så rytter-navn får plads
const ROLE_LABELS_SHORT: Record<string, string> = {
  leader: 'LDR',
  lieutenant: 'LIE',
  grimpeur: 'GRI',
  sprinter: 'SPR',
  domestique: 'DOM',
  equipier: 'EQP',
  joker: 'JOK',
}

function sortRiders(riders: RiderInLineup[]): RiderInLineup[] {
  return [...riders].sort((a, b) => {
    const ra = ROLE_ORDER.indexOf(a.role)
    const rb = ROLE_ORDER.indexOf(b.role)
    if (ra !== rb) return ra - rb
    return (a.slot_index ?? 0) - (b.slot_index ?? 0)
  })
}

export default function AllLineups({ gameId, stageId, currentUserId, profile }: Props) {
  const isTTT = profile === 'ttt'
  const [lineups, setLineups] = useState<LineupEntry[] | null>(null)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function fetchLineups() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/games/${gameId}/cycling/all-lineups?stage_id=${stageId}`)
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Fejl')
        setLineups([])
      } else {
        setLineups(data.lineups ?? [])
      }
    } catch {
      setError('Netværksfejl')
      setLineups([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open && lineups === null) fetchLineups()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, stageId])

  // Reset data når stage skifter
  useEffect(() => {
    setLineups(null)
  }, [stageId])

  return (
    <div style={{ marginTop: 16 }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: '100%', padding: '10px 14px',
          background: '#0F2137', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 2, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, fontWeight: 700,
          color: '#8FABC4', textTransform: 'uppercase', letterSpacing: '0.08em',
          transition: 'background 0.15s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = '#162d4a' }}
        onMouseLeave={(e) => { e.currentTarget.style.background = '#0F2137' }}
      >
        {open ? <EyeOff size={14} /> : <Eye size={14} />}
        <span>{open ? 'Skjul alle lineups' : 'Vis alle lineups'}</span>
        <Users size={14} />
      </button>

      {open && (
        <div style={{
          marginTop: 12, background: '#162d4a', borderRadius: 2,
          border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden',
        }}>
          {loading && (
            <div style={{
              padding: 24, textAlign: 'center',
              fontFamily: "'Barlow', sans-serif", fontSize: 13, color: '#8FABC4',
            }}>
              Henter lineups...
            </div>
          )}

          {error && !loading && (
            <div style={{
              padding: 24, textAlign: 'center',
              fontFamily: "'Barlow', sans-serif", fontSize: 13, color: '#ff6b6b',
            }}>
              {error}
            </div>
          )}

          {!loading && !error && lineups && lineups.length === 0 && (
            <div style={{
              padding: 24, textAlign: 'center',
              fontFamily: "'Barlow', sans-serif", fontSize: 13, color: '#8FABC4',
            }}>
              Ingen lineups for denne etape endnu
            </div>
          )}

          {!loading && !error && lineups && lineups.length > 0 && (
            // Responsive grid: 1 kolonne på mobil, 2 på md, op til 3 på lg.
            // CSS-vars bruges fordi lg-værdien er dynamisk (afhænger af antal
            // lineups). Mobil-default 1fr forhindrer at navne klippes på
            // iPhone (Nikolaj-rapporten 11. maj 2026).
            <div
              className="grid grid-cols-1 md:grid-cols-[var(--lineups-cols-md)] lg:grid-cols-[var(--lineups-cols-lg)]"
              style={{
                gap: 1,
                background: 'rgba(255,255,255,0.06)',
                ['--lineups-cols-md' as string]: lineups.length === 1 ? '1fr' : '1fr 1fr',
                ['--lineups-cols-lg' as string]: `repeat(${Math.min(lineups.length, 3)}, 1fr)`,
              } as React.CSSProperties}
            >
              {lineups.map((entry) => {
                const isMe = entry.user_id === currentUserId
                const allTotals = lineups.map((l) => l.total_points)
                const taunted = shouldTaunt(entry.total_points, allTotals)
                return (
                  <div
                    key={entry.user_id}
                    style={{
                      background: '#1E3A5F',
                      borderTop: isMe ? '2px solid #4A90D9' : 'none',
                    }}
                  >
                    {/* Header */}
                    <div style={{
                      padding: '10px 14px',
                      borderBottom: '1px solid rgba(255,255,255,0.08)',
                      background: isMe ? 'rgba(74,144,217,0.15)' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{
                          width: 26, height: 26, borderRadius: '50%',
                          background: isMe ? '#4A90D9' : '#2B4F7A',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontFamily: "'Barlow Condensed', sans-serif",
                          fontSize: 10, fontWeight: 800, color: '#fff',
                        }}>
                          {entry.username.slice(0, 2).toUpperCase()}
                        </div>
                        <span style={{
                          fontFamily: "'Barlow Condensed', sans-serif",
                          fontSize: 13, fontWeight: 700, color: '#F2EDE4',
                        }}>
                          {entry.username}{isMe && ' (dig)'}
                          {taunted && (
                            <span style={{
                              fontStyle: 'italic',
                              fontWeight: 400,
                              color: 'rgba(242,237,228,0.55)',
                              marginLeft: 6,
                              fontSize: 11,
                            }}>
                              {getTaunt(`${entry.user_id}:stage`)}
                            </span>
                          )}
                        </span>
                      </div>
                      <span style={{
                        fontFamily: "'Barlow Condensed', sans-serif",
                        fontSize: 14, fontWeight: 800, color: '#F2EDE4',
                      }}>
                        {Math.round(entry.total_points * 10) / 10}
                      </span>
                    </div>

                    {/* Riders */}
                    {sortRiders(entry.riders).map((r, idx) => (
                      <div
                        key={`${r.rider_id}-${r.role}-${r.slot_index}`}
                        style={{
                          padding: '8px 14px',
                          display: 'flex', alignItems: 'center', gap: 8,
                          borderBottom: idx < entry.riders.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                        }}
                      >
                        <span
                          className="font-condensed flex-shrink-0 w-9 sm:w-12"
                          style={{
                            fontFamily: "'Barlow Condensed', sans-serif",
                            fontSize: 9, fontWeight: 600, color: '#8FABC4',
                            letterSpacing: '0.04em',
                          }}
                        >
                          {/* Kort på mobil, fuld på sm+. På TTT er rollerne væk. */}
                          <span className="sm:hidden">{isTTT ? 'RYT' : (ROLE_LABELS_SHORT[r.role] ?? r.role.slice(0, 3).toUpperCase())}</span>
                          <span className="hidden sm:inline">{isTTT ? 'Rytter' : (ROLE_LABELS[r.role] ?? r.role)}</span>
                        </span>
                        <TeamLogo url={r.team_logo_url} team={r.team_name} />
                        <span style={{
                          flex: 1, fontFamily: "'Barlow Condensed', sans-serif",
                          fontSize: 12, fontWeight: 600, color: '#F2EDE4',
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        }}>
                          {r.last_name}
                        </span>
                        <CatBadge cat={r.category} />
                        {r.points !== null && (
                          <span style={{
                            fontFamily: "'Barlow Condensed', sans-serif",
                            fontSize: 11, fontWeight: 700,
                            color: r.points > 0 ? '#6B8F71' : r.points < 0 ? '#ff6b6b' : '#64748B',
                            minWidth: 28, textAlign: 'right',
                          }}>
                            {(() => {
                              const p = Math.round((r.points ?? 0) * 10) / 10
                              return p > 0 ? `+${p}` : `${p}`
                            })()}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
