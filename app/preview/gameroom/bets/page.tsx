'use client'

import { useRouter } from 'next/navigation'

const C = {
  bg: '#EDE8DF',
  surface: '#F7F4EF',
  white: '#FFFFFF',
  green: '#A8CFA1',
  greenDark: '#2D6A4F',
  greenDeep: '#1B4332',
  greenLight: '#D8EDDA',
  greenMid: '#74C69D',
  warm: '#C2A878',
  warmLight: '#F0E6D3',
  charcoal: '#2C2C2C',
  muted: '#8A9A8E',
  border: 'rgba(45,106,79,0.1)',
  red: '#E05252',
  redLight: '#FDEAEA',
  gold: '#F0B429',
}
const FONT = "'Plus Jakarta Sans', sans-serif"

function pill(label: string, bg: string, color: string) {
  return (
    <span style={{
      background: bg, color, borderRadius: 20,
      padding: '3px 10px', fontSize: 10, fontWeight: 700,
      letterSpacing: '0.06em', display: 'inline-block',
    }}>
      {label}
    </span>
  )
}

function Topbar({ onBack, breadcrumb }: { onBack: () => void; breadcrumb: React.ReactNode }) {
  return (
    <div style={{
      height: 52, background: C.surface,
      borderBottom: `1px solid ${C.border}`,
      display: 'flex', alignItems: 'center',
      padding: '0 24px', gap: 12,
    }}>
      <div
        onClick={onBack}
        style={{
          width: 30, height: 30, borderRadius: 8,
          background: C.greenDeep,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, color: C.greenLight, cursor: 'pointer',
        }}
      >←</div>
      <span style={{ fontFamily: FONT, fontSize: 16, fontWeight: 800, color: C.charcoal }}>
        Bodega<span style={{ color: C.greenMid }}>.</span>Bets
      </span>
      <div style={{ flex: 1, textAlign: 'center' }}>{breadcrumb}</div>
      <div style={{
        width: 32, height: 32, borderRadius: '50%',
        background: C.greenLight, color: C.greenDeep,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11, fontWeight: 800,
      }}>MK</div>
    </div>
  )
}

const B = 'https://bold.dk/img/tag/64x64'

const bets = [
  { home: 'FCK', away: 'Brøndby', homeLogo: `${B}/fc-koebenhavn.png`, awayLogo: `${B}/broendby-if.png`, league: 'Superliga', leagueLogo: `${B}/3f-superliga.png`, pick: 'FCK', odds: '1.85', status: 'won', pts: '+22' },
  { home: 'Liverpool', away: 'Man Utd', homeLogo: `${B}/liverpool.png`, awayLogo: `${B}/manchester-united.png`, league: 'Premier League', leagueLogo: `${B}/premier-league.png`, pick: 'Liverpool', odds: '1.60', status: 'lost', pts: '0' },
  { home: 'Bayern', away: 'BVB', homeLogo: `${B}/bayern-muenchen.png`, awayLogo: `${B}/borussia-dortmund.png`, league: 'Bundesliga', leagueLogo: `${B}/1-bundesliga.png`, pick: 'Bayern', odds: '1.70', status: 'won', pts: '+18' },
  { home: 'PSG', away: 'Marseille', homeLogo: `${B}/paris-saint-germain.png`, awayLogo: `${B}/olympique-marseille.png`, league: 'Ligue 1', leagueLogo: `${B}/ligue-1.png`, pick: 'PSG', odds: '1.45', status: 'won', pts: '+14' },
  { home: 'Real Madrid', away: 'Barça', homeLogo: `${B}/real-madrid.png`, awayLogo: `${B}/fc-barcelona.png`, league: 'La Liga', leagueLogo: `${B}/la-liga.png`, pick: 'Barça', odds: '3.60', status: 'open', pts: '—' },
  { home: 'Man City', away: 'Arsenal', homeLogo: `${B}/manchester-city.png`, awayLogo: `${B}/arsenal.png`, league: 'Premier League', leagueLogo: `${B}/premier-league.png`, pick: 'Man City', odds: '1.60', status: 'open', pts: '—' },
]

const statusPill = (s: string) => {
  if (s === 'won') return pill('Vundet', C.greenLight, C.greenDark)
  if (s === 'lost') return pill('Tabt', C.redLight, C.red)
  return pill('Åben', C.warmLight, C.warm)
}

function Sidebar() {
  const navItems = [
    { label: 'Mine bets', active: true },
    { label: 'Leaderboard', active: false },
    { label: 'Konsensus', active: false },
    { label: 'Stats', active: false },
  ]
  const rounds = [
    { label: 'Uge 28', sub: 'aktiv', active: true },
    { label: 'Uge 27', active: false },
    { label: 'Uge 26', active: false },
    { label: 'Uge 25', active: false },
  ]

  return (
    <div style={{
      width: 200, background: C.greenDeep,
      display: 'flex', flexDirection: 'column',
      minHeight: 'calc(100vh - 52px)',
    }}>
      {/* Room info */}
      <div style={{ padding: 16, borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div style={{ fontFamily: FONT, fontSize: 13, fontWeight: 800, color: '#fff' }}>Bodega Betting</div>
        <div style={{ fontFamily: FONT, fontSize: 10, color: 'rgba(116,198,157,0.6)', marginTop: 2 }}>6 spillere · Block 3</div>
      </div>

      {/* Nav */}
      <div style={{ padding: '8px 0' }}>
        {navItems.map((item) => (
          <div key={item.label} style={{
            padding: '9px 16px',
            fontFamily: FONT, fontSize: 12, fontWeight: item.active ? 700 : 500,
            color: item.active ? '#fff' : 'rgba(255,255,255,0.5)',
            background: item.active ? 'rgba(255,255,255,0.07)' : 'transparent',
            borderRight: item.active ? `2px solid ${C.greenMid}` : '2px solid transparent',
            cursor: 'pointer',
          }}>
            {item.label}
          </div>
        ))}
      </div>

      {/* Rounds */}
      <div style={{ padding: 16, marginTop: 8 }}>
        <div style={{ fontFamily: FONT, fontSize: 8, fontWeight: 700, color: 'rgba(116,198,157,0.4)', letterSpacing: '0.12em', marginBottom: 8 }}>
          RUNDER
        </div>
        {rounds.map((r, i) => (
          <div key={r.label} style={{
            padding: '8px 0',
            borderBottom: i < rounds.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
            fontFamily: FONT, fontSize: 11,
            color: r.active ? C.greenMid : 'rgba(255,255,255,0.35)',
            fontWeight: r.active ? 700 : 500,
            cursor: 'pointer',
          }}>
            {r.label}{r.sub ? <span style={{ fontWeight: 500, marginLeft: 4 }}>· {r.sub}</span> : ''}
          </div>
        ))}
      </div>
    </div>
  )
}

function LeaderboardRow({ rank, name, av, pts, correct, me }: {
  rank: number; name: string; av: string; pts: number; correct: string; me?: boolean
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '8px 10px', borderRadius: 10,
      background: me ? C.greenLight : 'transparent',
    }}>
      <span style={{
        fontFamily: FONT, fontSize: 12, fontWeight: 800, width: 16, textAlign: 'center',
        color: rank === 1 ? C.gold : rank === 2 ? '#94A3B8' : C.muted,
      }}>{rank}</span>
      <div style={{
        width: 24, height: 24, borderRadius: '50%',
        background: me ? C.greenDeep : C.greenLight,
        color: me ? C.greenLight : C.greenDeep,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 7, fontWeight: 800,
      }}>{av}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: FONT, fontSize: 12, fontWeight: me ? 700 : 500, color: C.charcoal }}>
          {name}{me ? ' ◂' : ''}
        </div>
        <div style={{ fontFamily: FONT, fontSize: 9, color: C.muted }}>{correct}</div>
      </div>
      <span style={{ fontFamily: FONT, fontSize: 13, fontWeight: 800, color: C.charcoal }}>{pts}</span>
    </div>
  )
}

export default function BetsPage() {
  const router = useRouter()

  return (
    <div style={{ fontFamily: FONT, background: C.bg, minHeight: '100vh' }}>
      <Topbar
        onBack={() => router.push('/preview/gameroom')}
        breadcrumb={
          <span style={{ fontFamily: FONT, fontSize: 11, color: C.muted }}>
            Mine rum / <span style={{ fontWeight: 700, color: C.greenDark }}>Bodega Betting</span> / Mine bets
          </span>
        }
      />

      <div style={{ display: 'flex', minHeight: 'calc(100vh - 52px)' }}>
        <Sidebar />

        {/* Main */}
        <div style={{ flex: 1, padding: 20 }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontFamily: FONT, fontSize: 18, fontWeight: 800, color: C.greenDeep }}>
              Mine bets · Uge 28
            </div>
            <div style={{ fontFamily: FONT, fontSize: 12, color: C.muted, marginTop: 2 }}>
              6 af 9 kampe spillet · 3 åbne · 124 point indtil videre
            </div>
          </div>

          {/* Bets table */}
          <div style={{
            background: C.surface, borderRadius: 14,
            border: `1px solid ${C.border}`, overflow: 'hidden',
          }}>
            {/* Header */}
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 100px 60px 80px 60px',
              padding: '8px 16px',
              background: 'rgba(45,106,79,0.04)',
            }}>
              {['KAMP', 'MIT BET', 'ODDS', 'STATUS', 'POINT'].map((h, i) => (
                <span key={h} style={{
                  fontFamily: FONT, fontSize: 9, fontWeight: 700, color: C.muted,
                  letterSpacing: '0.08em',
                  textAlign: i === 4 ? 'right' : 'left',
                }}>{h}</span>
              ))}
            </div>

            {/* Rows */}
            {bets.map((bet, idx) => (
              <div key={idx} style={{
                display: 'grid', gridTemplateColumns: '1fr 100px 60px 80px 60px',
                padding: '11px 16px', alignItems: 'center',
                borderBottom: idx < bets.length - 1 ? `1px solid ${C.border}` : 'none',
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <img src={bet.homeLogo} alt="" style={{ width: 16, height: 16, objectFit: 'contain' }} />
                    <span style={{ fontFamily: FONT, fontSize: 12, fontWeight: 600, color: C.charcoal }}>{bet.home}</span>
                    <span style={{ fontFamily: FONT, fontSize: 10, color: C.muted }}>vs</span>
                    <span style={{ fontFamily: FONT, fontSize: 12, fontWeight: 600, color: C.charcoal }}>{bet.away}</span>
                    <img src={bet.awayLogo} alt="" style={{ width: 16, height: 16, objectFit: 'contain' }} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                    {bet.leagueLogo && <img src={bet.leagueLogo} alt="" style={{ width: 10, height: 10, objectFit: 'contain' }} />}
                    <span style={{ fontFamily: FONT, fontSize: 9, color: C.muted }}>{bet.league}</span>
                  </div>
                </div>
                <span style={{ fontFamily: FONT, fontSize: 12, fontWeight: 600, color: C.charcoal }}>{bet.pick}</span>
                <span style={{ fontFamily: FONT, fontSize: 12, color: C.charcoal }}>{bet.odds}</span>
                <div>{statusPill(bet.status)}</div>
                <span style={{
                  fontFamily: FONT, fontSize: 13, fontWeight: 800, textAlign: 'right',
                  color: bet.pts.startsWith('+') ? C.greenDark : C.muted,
                }}>{bet.pts}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right panel */}
        <div style={{
          width: 260, background: C.surface,
          borderLeft: `1px solid ${C.border}`,
          padding: 20, display: 'flex', flexDirection: 'column', gap: 16,
        }}>
          {/* Leaderboard */}
          <div>
            <div style={{ fontFamily: FONT, fontSize: 12, fontWeight: 700, color: C.charcoal, marginBottom: 10 }}>
              Leaderboard · live
            </div>
            <LeaderboardRow rank={1} name="Jonas" av="JR" pts={148} correct="5/6 rigtige" />
            <LeaderboardRow rank={2} name="Peter" av="PL" pts={138} correct="4/6 rigtige" />
            <LeaderboardRow rank={3} name="Mikkel" av="MK" pts={124} correct="4/6 rigtige" me />
            <LeaderboardRow rank={4} name="Simon" av="SK" pts={117} correct="3/6 rigtige" />
            <LeaderboardRow rank={5} name="Anders" av="AN" pts={109} correct="3/6 rigtige" />
          </div>

          <div style={{ height: 1, background: C.border }} />

          {/* Consensus */}
          <div>
            <div style={{ fontFamily: FONT, fontSize: 12, fontWeight: 700, color: C.charcoal, marginBottom: 10 }}>
              Konsensus · åbne kampe
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[
                { match: 'Real Madrid vs Barça', count: '4 af 6', label: 'valgte Barça', pct: 66 },
                { match: 'Man City vs Arsenal', count: '5 af 6', label: 'valgte City', pct: 83 },
              ].map((c) => (
                <div key={c.match} style={{
                  background: C.bg, borderRadius: 10, padding: 10, textAlign: 'center',
                }}>
                  <div style={{ fontFamily: FONT, fontSize: 9, color: C.muted, marginBottom: 4 }}>{c.match}</div>
                  <div style={{ fontFamily: FONT, fontSize: 18, fontWeight: 800, color: C.greenDeep }}>{c.count}</div>
                  <div style={{ fontFamily: FONT, fontSize: 9, color: C.muted, marginTop: 2 }}>{c.label}</div>
                  <div style={{ height: 3, borderRadius: 3, background: C.border, marginTop: 6 }}>
                    <div style={{ height: '100%', borderRadius: 3, background: C.greenMid, width: `${c.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
