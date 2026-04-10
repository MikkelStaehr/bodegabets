'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft, Target, Award, BarChart3, Trophy, TrendingUp, Lock, Check, X, Minus } from 'lucide-react'

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
const B = 'https://bold.dk/img/tag/64x64'

function pill(label: string, bg: string, color: string, icon?: React.ReactNode) {
  return (
    <span style={{
      background: bg, color, borderRadius: 20,
      padding: '3px 10px', fontSize: 10, fontWeight: 700,
      letterSpacing: '0.06em', display: 'inline-flex',
      alignItems: 'center', gap: 4,
    }}>
      {icon}{label}
    </span>
  )
}

function Topbar({ onBack }: { onBack: () => void }) {
  return (
    <div style={{
      height: 52, background: C.surface,
      borderBottom: `1px solid ${C.border}`,
      display: 'flex', alignItems: 'center',
      padding: '0 24px', gap: 12,
    }}>
      <div onClick={onBack} style={{
        width: 30, height: 30, borderRadius: 8,
        background: C.greenDeep,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', color: C.greenLight,
      }}>
        <ArrowLeft size={14} />
      </div>
      <span style={{ fontFamily: FONT, fontSize: 16, fontWeight: 800, color: C.charcoal }}>
        Bodega<span style={{ color: C.greenMid }}>.</span>Bets
      </span>
      <div style={{ flex: 1, textAlign: 'center' }}>
        <span style={{ fontFamily: FONT, fontSize: 11, color: C.muted }}>
          Mine rum / <span style={{ fontWeight: 700, color: C.greenDark }}>Bodega Betting</span>
        </span>
      </div>
      <div style={{
        width: 32, height: 32, borderRadius: '50%',
        background: C.greenLight, color: C.greenDeep,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11, fontWeight: 800,
      }}>MK</div>
    </div>
  )
}

// ─── Sidebar ─────────────────────────────────────────────────

function Sidebar() {
  const navItems = [
    { label: 'Overblik', icon: <BarChart3 size={13} />, active: true },
    { label: 'Leaderboard', icon: <Trophy size={13} />, active: false },
    { label: 'Konsensus', icon: <TrendingUp size={13} />, active: false },
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
      {/* Room header */}
      <div style={{ padding: '18px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div style={{ fontFamily: FONT, fontSize: 14, fontWeight: 800, color: '#fff' }}>Bodega Betting</div>
        <div style={{ fontFamily: FONT, fontSize: 10, color: 'rgba(116,198,157,0.6)', marginTop: 3 }}>6 spillere · Block 3</div>
      </div>

      {/* Nav */}
      <div style={{ padding: '8px 0' }}>
        {navItems.map((item) => (
          <div key={item.label} style={{
            padding: '10px 16px',
            fontFamily: FONT, fontSize: 12, fontWeight: item.active ? 700 : 500,
            color: item.active ? '#fff' : 'rgba(255,255,255,0.45)',
            background: item.active ? 'rgba(255,255,255,0.07)' : 'transparent',
            borderRight: item.active ? `2px solid ${C.greenMid}` : '2px solid transparent',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 8,
            transition: 'all 0.15s',
          }}>
            {item.icon}
            {item.label}
          </div>
        ))}
      </div>

      {/* Rounds */}
      <div style={{ padding: 16, marginTop: 8 }}>
        <div style={{ fontFamily: FONT, fontSize: 8, fontWeight: 700, color: 'rgba(116,198,157,0.4)', letterSpacing: '0.12em', marginBottom: 10 }}>
          RUNDER
        </div>
        {rounds.map((r, i) => (
          <div key={r.label} style={{
            padding: '8px 0',
            borderBottom: i < rounds.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
            fontFamily: FONT, fontSize: 11,
            color: r.active ? C.greenMid : 'rgba(255,255,255,0.3)',
            fontWeight: r.active ? 700 : 500,
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            {r.active && <div style={{ width: 4, height: 4, borderRadius: '50%', background: C.greenMid }} />}
            {r.label}{r.sub ? <span style={{ fontWeight: 500, opacity: 0.7 }}>· {r.sub}</span> : ''}
          </div>
        ))}
      </div>

      {/* Stats mini */}
      <div style={{ marginTop: 'auto', padding: 16, borderTop: '1px solid rgba(255,255,255,0.07)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontFamily: FONT, fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>Dine point</span>
          <span style={{ fontFamily: FONT, fontSize: 13, fontWeight: 800, color: '#fff' }}>124</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontFamily: FONT, fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>Placering</span>
          <span style={{ fontFamily: FONT, fontSize: 13, fontWeight: 800, color: C.greenMid }}>3.</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontFamily: FONT, fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>Hit rate</span>
          <span style={{ fontFamily: FONT, fontSize: 13, fontWeight: 800, color: '#fff' }}>62%</span>
        </div>
      </div>
    </div>
  )
}

// ─── Bet data ────────────────────────────────────────────────

const bets = [
  { home: 'FCK', away: 'Brøndby', homeLogo: `${B}/fc-koebenhavn.png`, awayLogo: `${B}/broendby-if.png`, league: 'Superliga', leagueLogo: `${B}/3f-superliga.png`, pick: 'FCK', odds: '1.85', status: 'won', pts: '+22' },
  { home: 'Liverpool', away: 'Man Utd', homeLogo: `${B}/liverpool.png`, awayLogo: `${B}/manchester-united.png`, league: 'Premier League', leagueLogo: `${B}/premier-league.png`, pick: 'Liverpool', odds: '1.60', status: 'lost', pts: '0' },
  { home: 'Bayern', away: 'BVB', homeLogo: `${B}/bayern-muenchen.png`, awayLogo: `${B}/borussia-dortmund.png`, league: 'Bundesliga', leagueLogo: `${B}/1-bundesliga.png`, pick: 'Bayern', odds: '1.70', status: 'won', pts: '+18' },
  { home: 'PSG', away: 'Marseille', homeLogo: `${B}/paris-saint-germain.png`, awayLogo: `${B}/olympique-marseille.png`, league: 'Ligue 1', leagueLogo: `${B}/ligue-1.png`, pick: 'PSG', odds: '1.45', status: 'won', pts: '+14' },
  { home: 'Real Madrid', away: 'Barça', homeLogo: `${B}/real-madrid.png`, awayLogo: `${B}/fc-barcelona.png`, league: 'La Liga', leagueLogo: `${B}/la-liga.png`, pick: 'Barça', odds: '3.60', status: 'open', pts: '—' },
  { home: 'Man City', away: 'Arsenal', homeLogo: `${B}/manchester-city.png`, awayLogo: `${B}/arsenal.png`, league: 'Premier League', leagueLogo: `${B}/premier-league.png`, pick: 'Man City', odds: '1.60', status: 'open', pts: '—' },
]

function StatusIcon({ status }: { status: string }) {
  if (status === 'won') return <div style={{ width: 18, height: 18, borderRadius: '50%', background: C.greenLight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Check size={10} color={C.greenDark} strokeWidth={3} /></div>
  if (status === 'lost') return <div style={{ width: 18, height: 18, borderRadius: '50%', background: C.redLight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={10} color={C.red} strokeWidth={3} /></div>
  return <div style={{ width: 18, height: 18, borderRadius: '50%', background: C.warmLight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Minus size={10} color={C.warm} strokeWidth={3} /></div>
}

// ─── Leaderboard ─────────────────────────────────────────────

function LeaderboardRow({ rank, name, av, pts, correct, me }: {
  rank: number; name: string; av: string; pts: number; correct: string; me?: boolean
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '9px 10px', borderRadius: 10,
      background: me ? C.greenLight : 'transparent',
    }}>
      <span style={{
        fontFamily: FONT, fontSize: 12, fontWeight: 800, width: 16, textAlign: 'center',
        color: rank === 1 ? C.gold : rank === 2 ? '#94A3B8' : C.muted,
      }}>{rank}</span>
      <div style={{
        width: 26, height: 26, borderRadius: '50%',
        background: me ? C.greenDeep : C.greenLight,
        color: me ? C.greenLight : C.greenDeep,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 8, fontWeight: 800,
      }}>{av}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: FONT, fontSize: 12, fontWeight: me ? 700 : 500, color: C.charcoal }}>
          {name}{me ? ' ◂' : ''}
        </div>
        <div style={{ fontFamily: FONT, fontSize: 9, color: C.muted }}>{correct}</div>
      </div>
      <span style={{ fontFamily: FONT, fontSize: 14, fontWeight: 800, color: C.charcoal }}>{pts}</span>
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────

export default function GameroomPage() {
  const router = useRouter()

  const wonCount = bets.filter(b => b.status === 'won').length
  const totalPlayed = bets.filter(b => b.status !== 'open').length

  return (
    <div style={{ fontFamily: FONT, background: C.bg, minHeight: '100vh' }}>
      <Topbar onBack={() => router.push('/preview/dashboard')} />

      <div style={{ display: 'flex', minHeight: 'calc(100vh - 52px)' }}>
        <Sidebar />

        {/* Main */}
        <div style={{ flex: 1, padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Hero stats bar */}
          <div style={{
            background: `linear-gradient(135deg, ${C.greenDeep} 0%, #244E3D 100%)`,
            borderRadius: 16, padding: '18px 24px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            position: 'relative', overflow: 'hidden',
          }}>
            <div style={{ position: 'absolute', top: -40, right: -40, width: 140, height: 140, borderRadius: '50%', border: '1px solid rgba(116,198,157,0.06)' }} />
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 16 }}>
              <div>
                <div style={{ fontFamily: FONT, fontSize: 10, color: C.greenMid, letterSpacing: '0.1em', fontWeight: 700 }}>UGE 28 · BLOCK 3</div>
                <div style={{ fontFamily: FONT, fontSize: 20, fontWeight: 800, color: '#fff', marginTop: 2 }}>Bodega Betting</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, position: 'relative' }}>
              {[
                { value: '124', label: 'Point', icon: <Target size={12} color={C.greenMid} /> },
                { value: '3.', label: 'Plads', icon: <Award size={12} color={C.greenMid} /> },
                { value: `${totalPlayed}/9`, label: 'Spillet', icon: <BarChart3 size={12} color={C.greenMid} /> },
                { value: `${wonCount}/${totalPlayed}`, label: 'Rigtige', icon: <Check size={12} color={C.greenMid} /> },
              ].map((s) => (
                <div key={s.label} style={{
                  textAlign: 'center', padding: '8px 14px',
                  borderRadius: 10, background: 'rgba(255,255,255,0.07)',
                  minWidth: 60,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 3 }}>{s.icon}</div>
                  <div style={{ fontFamily: FONT, fontSize: 18, fontWeight: 800, color: '#fff' }}>{s.value}</div>
                  <div style={{ fontFamily: FONT, fontSize: 8, color: C.greenMid, letterSpacing: '0.06em' }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Bets header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontFamily: FONT, fontSize: 16, fontWeight: 800, color: C.greenDeep }}>
                Mine bets
              </div>
              <div style={{ fontFamily: FONT, fontSize: 11, color: C.muted, marginTop: 2 }}>
                {totalPlayed} af 9 kampe spillet · {bets.filter(b => b.status === 'open').length} åbne
              </div>
            </div>
            {pill('Bets lukker mandag', C.warmLight, C.warm, <Lock size={9} />)}
          </div>

          {/* Bets table */}
          <div style={{
            background: C.white, borderRadius: 14,
            border: `1px solid ${C.border}`,
            boxShadow: '0 2px 12px rgba(27,67,50,0.04)',
            overflow: 'hidden',
          }}>
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 90px 60px 40px 60px',
              padding: '10px 18px',
              background: 'rgba(45,106,79,0.03)',
              borderBottom: `1px solid ${C.border}`,
            }}>
              {['KAMP', 'MIT BET', 'ODDS', '', 'POINT'].map((h, i) => (
                <span key={h} style={{
                  fontFamily: FONT, fontSize: 9, fontWeight: 700, color: C.muted,
                  letterSpacing: '0.08em',
                  textAlign: i === 4 ? 'right' : 'left',
                }}>{h}</span>
              ))}
            </div>

            {bets.map((bet, idx) => (
              <div key={idx} style={{
                display: 'grid', gridTemplateColumns: '1fr 90px 60px 40px 60px',
                padding: '12px 18px', alignItems: 'center',
                borderBottom: idx < bets.length - 1 ? `1px solid ${C.border}` : 'none',
                transition: 'background 0.1s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(45,106,79,0.02)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <img src={bet.homeLogo} alt="" style={{ width: 18, height: 18, objectFit: 'contain' }} />
                    <span style={{ fontFamily: FONT, fontSize: 12, fontWeight: 600, color: C.charcoal }}>{bet.home}</span>
                    <span style={{ fontFamily: FONT, fontSize: 10, color: C.muted }}>–</span>
                    <span style={{ fontFamily: FONT, fontSize: 12, fontWeight: 600, color: C.charcoal }}>{bet.away}</span>
                    <img src={bet.awayLogo} alt="" style={{ width: 18, height: 18, objectFit: 'contain' }} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 3 }}>
                    {bet.leagueLogo && <img src={bet.leagueLogo} alt="" style={{ width: 10, height: 10, objectFit: 'contain' }} />}
                    <span style={{ fontFamily: FONT, fontSize: 9, color: C.muted }}>{bet.league}</span>
                  </div>
                </div>
                <span style={{
                  fontFamily: FONT, fontSize: 12, fontWeight: 700, color: C.charcoal,
                  padding: '3px 8px', background: C.bg, borderRadius: 6,
                  display: 'inline-block',
                }}>{bet.pick}</span>
                <span style={{ fontFamily: FONT, fontSize: 12, fontWeight: 600, color: C.muted }}>{bet.odds}</span>
                <StatusIcon status={bet.status} />
                <span style={{
                  fontFamily: FONT, fontSize: 14, fontWeight: 800, textAlign: 'right',
                  color: bet.pts.startsWith('+') ? C.greenDark : bet.pts === '0' ? C.red : C.muted,
                }}>{bet.pts}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right panel */}
        <div style={{
          width: 270, background: C.surface,
          borderLeft: `1px solid ${C.border}`,
          padding: 20, display: 'flex', flexDirection: 'column', gap: 16,
        }}>
          {/* Leaderboard */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontFamily: FONT, fontSize: 12, fontWeight: 700, color: C.charcoal }}>Leaderboard</span>
              {pill('Live', C.greenLight, C.greenDark)}
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
            {[
              { match: 'Real Madrid vs Barça', count: '4 af 6', label: 'valgte Barça', pct: 66 },
              { match: 'Man City vs Arsenal', count: '5 af 6', label: 'valgte City', pct: 83 },
            ].map((c) => (
              <div key={c.match} style={{
                background: C.bg, borderRadius: 10, padding: 12, marginBottom: 8,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontFamily: FONT, fontSize: 10, fontWeight: 600, color: C.charcoal }}>{c.match}</span>
                  <span style={{ fontFamily: FONT, fontSize: 10, fontWeight: 800, color: C.greenDark }}>{c.pct}%</span>
                </div>
                <div style={{ height: 4, borderRadius: 4, background: C.border }}>
                  <div style={{ height: '100%', borderRadius: 4, background: C.greenMid, width: `${c.pct}%`, transition: 'width 0.5s' }} />
                </div>
                <div style={{ fontFamily: FONT, fontSize: 9, color: C.muted, marginTop: 4 }}>
                  {c.count} {c.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
