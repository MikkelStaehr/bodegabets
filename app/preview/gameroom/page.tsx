'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Zap, Trophy, BarChart3, TrendingUp, Check, X, Minus, Lock, ChevronDown, Bike, Mountain, Route, Timer } from 'lucide-react'

const T = {
  bg: '#0B0D0F',
  surface: '#141619',
  elevated: '#1A1D21',
  card: '#1E2227',
  border: 'rgba(255,255,255,0.06)',
  borderLight: 'rgba(255,255,255,0.1)',
  accent: '#00E676',
  accentDim: 'rgba(0,230,118,0.12)',
  accentGlow: 'rgba(0,230,118,0.25)',
  purple: '#7C6AFF',
  purpleDim: 'rgba(124,106,255,0.12)',
  gold: '#FFD54F',
  goldDim: 'rgba(255,213,79,0.12)',
  red: '#FF5252',
  redDim: 'rgba(255,82,82,0.12)',
  orange: '#FFB74D',
  orangeDim: 'rgba(255,183,77,0.12)',
  white: '#FFFFFF',
  t1: '#F5F5F5',
  t2: '#9CA3AF',
  t3: '#6B7280',
  t4: '#3B3F45',
}
const F = "'Plus Jakarta Sans', sans-serif"
const B = 'https://bold.dk/img/tag/64x64'

// ─── Shared ─────────────────────────────────────────────────

function Topbar({ onBack, title, subtitle }: { onBack: () => void; title: string; subtitle: string }) {
  return (
    <div style={{
      height: 56, display: 'flex', alignItems: 'center',
      padding: '0 24px', gap: 14,
      borderBottom: `1px solid ${T.border}`,
    }}>
      <div onClick={onBack} style={{
        width: 32, height: 32, borderRadius: 10,
        background: T.elevated, border: `1px solid ${T.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', color: T.t2, transition: 'all 0.15s',
      }}>
        <ArrowLeft size={14} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: F, fontSize: 14, fontWeight: 800, color: T.white }}>{title}</div>
        <div style={{ fontFamily: F, fontSize: 10, color: T.t3 }}>{subtitle}</div>
      </div>
      <div style={{
        width: 34, height: 34, borderRadius: '50%',
        background: `linear-gradient(135deg, ${T.purple}, #9C8AFF)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11, fontWeight: 800, color: '#fff',
      }}>MS</div>
    </div>
  )
}

function StatusDot({ status }: { status: string }) {
  const config = {
    won: { bg: T.accentDim, color: T.accent, icon: <Check size={10} strokeWidth={3} /> },
    lost: { bg: T.redDim, color: T.red, icon: <X size={10} strokeWidth={3} /> },
    open: { bg: T.orangeDim, color: T.orange, icon: <Minus size={10} strokeWidth={2} /> },
  }[status] ?? { bg: T.elevated, color: T.t3, icon: <Minus size={10} /> }

  return (
    <div style={{
      width: 22, height: 22, borderRadius: '50%',
      background: config.bg, color: config.color,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>{config.icon}</div>
  )
}

function LeaderboardRow({ rank, name, pts, delta, me, sub }: {
  rank: number; name: string; pts: number; delta: string; me?: boolean; sub?: string
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 12px', borderRadius: 10,
      background: me ? T.accentDim : 'transparent',
      border: me ? `1px solid rgba(0,230,118,0.1)` : '1px solid transparent',
    }}>
      <span style={{
        fontFamily: F, fontSize: 13, fontWeight: 800, width: 18,
        color: rank === 1 ? T.gold : rank === 2 ? '#C0C0C0' : rank === 3 ? '#CD7F32' : T.t3,
      }}>{rank}</span>
      <div style={{
        width: 28, height: 28, borderRadius: '50%',
        background: me ? T.accent : T.elevated,
        color: me ? T.bg : T.t2,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 9, fontWeight: 800,
      }}>{name.slice(0, 2).toUpperCase()}</div>
      <div style={{ flex: 1 }}>
        <span style={{ fontFamily: F, fontSize: 12, fontWeight: me ? 700 : 500, color: T.white }}>{name}</span>
        {sub && <div style={{ fontFamily: F, fontSize: 9, color: T.t3 }}>{sub}</div>}
      </div>
      <span style={{ fontFamily: F, fontSize: 15, fontWeight: 800, color: T.white }}>{pts}</span>
      <span style={{
        fontFamily: F, fontSize: 10, fontWeight: 700, width: 30, textAlign: 'right',
        color: delta.startsWith('+') ? T.accent : delta.startsWith('-') ? T.red : T.t3,
      }}>{delta}</span>
    </div>
  )
}

// ─── Football Tab ───────────────────────────────────────────

const footballBets = [
  { home: 'FCK', away: 'Brøndby', hLogo: `${B}/fc-koebenhavn.png`, aLogo: `${B}/broendby-if.png`, league: 'Superliga', pick: 'FCK', odds: '1.85', status: 'won', pts: '+22' },
  { home: 'Liverpool', away: 'Man Utd', hLogo: `${B}/liverpool.png`, aLogo: `${B}/manchester-united.png`, league: 'Premier League', pick: 'Liverpool', odds: '1.60', status: 'lost', pts: '0' },
  { home: 'Bayern', away: 'Dortmund', hLogo: `${B}/bayern-muenchen.png`, aLogo: `${B}/borussia-dortmund.png`, league: 'Bundesliga', pick: 'Bayern', odds: '1.70', status: 'won', pts: '+18' },
  { home: 'PSG', away: 'Marseille', hLogo: `${B}/paris-saint-germain.png`, aLogo: `${B}/olympique-marseille.png`, league: 'Ligue 1', pick: 'PSG', odds: '1.45', status: 'won', pts: '+14' },
  { home: 'Real Madrid', away: 'Barcelona', hLogo: `${B}/real-madrid.png`, aLogo: `${B}/fc-barcelona.png`, league: 'La Liga', pick: 'Barça', odds: '3.60', status: 'open', pts: '—' },
  { home: 'Man City', away: 'Arsenal', hLogo: `${B}/manchester-city.png`, aLogo: `${B}/arsenal.png`, league: 'Premier League', pick: 'Man City', odds: '1.60', status: 'open', pts: '—' },
]

function FootballContent() {
  return (
    <>
      {/* Bets table */}
      <div style={{
        background: T.surface, borderRadius: 14,
        border: `1px solid ${T.border}`, overflow: 'hidden',
      }}>
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 80px 50px 32px 50px',
          padding: '10px 18px', borderBottom: `1px solid ${T.border}`,
        }}>
          {['KAMP', 'BET', 'ODDS', '', 'PT'].map((h, i) => (
            <span key={h} style={{
              fontFamily: F, fontSize: 9, fontWeight: 700, color: T.t4,
              letterSpacing: '0.1em', textAlign: i >= 3 ? 'center' : 'left',
            }}>{h}</span>
          ))}
        </div>

        {footballBets.map((bet, idx) => (
          <div key={idx} style={{
            display: 'grid', gridTemplateColumns: '1fr 80px 50px 32px 50px',
            padding: '13px 18px', alignItems: 'center',
            borderBottom: idx < footballBets.length - 1 ? `1px solid ${T.border}` : 'none',
            transition: 'background 0.1s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = T.elevated }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <img src={bet.hLogo} alt="" style={{ width: 20, height: 20, objectFit: 'contain' }} />
              <div>
                <div style={{ fontFamily: F, fontSize: 12, fontWeight: 600, color: T.white }}>
                  {bet.home} <span style={{ color: T.t4 }}>–</span> {bet.away}
                </div>
                <div style={{ fontFamily: F, fontSize: 9, color: T.t3 }}>{bet.league}</div>
              </div>
              <img src={bet.aLogo} alt="" style={{ width: 20, height: 20, objectFit: 'contain' }} />
            </div>
            <span style={{
              fontFamily: F, fontSize: 11, fontWeight: 700, color: T.white,
              padding: '3px 8px', borderRadius: 6, background: T.elevated,
              border: `1px solid ${T.border}`, display: 'inline-block',
            }}>{bet.pick}</span>
            <span style={{ fontFamily: F, fontSize: 11, color: T.t2 }}>{bet.odds}</span>
            <div style={{ display: 'flex', justifyContent: 'center' }}><StatusDot status={bet.status} /></div>
            <span style={{
              fontFamily: F, fontSize: 14, fontWeight: 800, textAlign: 'center',
              color: bet.pts.startsWith('+') ? T.accent : bet.pts === '0' ? T.red : T.t3,
            }}>{bet.pts}</span>
          </div>
        ))}
      </div>
    </>
  )
}

// ─── Cycling Tab ────────────────────────────────────────────

const riders = [
  { name: 'Pogačar', team: 'UAE', role: 'Leader', cat: 1, pts: '+32' },
  { name: 'van Aert', team: 'Visma', role: 'Sprinter', cat: 1, pts: '+18' },
  { name: 'Pedersen', team: 'Lidl-Trek', role: 'Lieutenant', cat: 2, pts: '+14' },
  { name: 'van der Poel', team: 'Alpecin', role: 'Grimpeur', cat: 1, pts: '+28' },
  { name: 'Küng', team: 'Groupama', role: 'Domestique', cat: 4, pts: '+5' },
  { name: 'Lampaert', team: 'Soudal', role: 'Équipier', cat: 3, pts: '+8' },
  { name: 'Stuyven', team: 'Lidl-Trek', role: 'Équipier', cat: 3, pts: '+6' },
  { name: 'Philipsen', team: 'Alpecin', role: 'Joker', cat: 2, pts: '—' },
]

const catColors: Record<number, string> = { 1: T.gold, 2: T.accent, 3: T.purple, 4: T.orange }

function CyclingContent() {
  return (
    <>
      {/* Race info */}
      <div style={{
        background: T.surface, borderRadius: 14,
        border: `1px solid ${T.border}`, padding: '18px 20px',
        marginBottom: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div>
            <div style={{ fontFamily: F, fontSize: 10, fontWeight: 700, color: T.t3, letterSpacing: '0.1em' }}>ARDENNERNE · SØNDAG</div>
            <div style={{ fontFamily: F, fontSize: 20, fontWeight: 800, color: T.white, marginTop: 4 }}>Paris–Roubaix</div>
          </div>
          <span style={{
            fontFamily: F, fontSize: 10, fontWeight: 700, color: T.red,
            padding: '4px 10px', borderRadius: 8, background: T.redDim,
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
            <Lock size={10} /> Låser lør 10:00
          </span>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {[
            { icon: <Route size={13} />, value: '258 km', label: 'Distance' },
            { icon: <Mountain size={13} />, value: 'Brosten', label: 'Profil' },
            { icon: <TrendingUp size={13} />, value: '1.288 m', label: 'Højdemeter' },
            { icon: <Timer size={13} />, value: 'PS 14', label: 'Score' },
          ].map((s) => (
            <div key={s.label} style={{
              flex: 1, padding: '10px 8px', borderRadius: 10,
              background: T.elevated, border: `1px solid ${T.border}`,
              textAlign: 'center',
            }}>
              <div style={{ display: 'flex', justifyContent: 'center', color: T.accent, marginBottom: 4 }}>{s.icon}</div>
              <div style={{ fontFamily: F, fontSize: 14, fontWeight: 800, color: T.white }}>{s.value}</div>
              <div style={{ fontFamily: F, fontSize: 8, color: T.t3, marginTop: 2, letterSpacing: '0.06em' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Lineup */}
      <div style={{
        background: T.surface, borderRadius: 14,
        border: `1px solid ${T.border}`, overflow: 'hidden',
      }}>
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 80px 50px 50px',
          padding: '10px 18px', borderBottom: `1px solid ${T.border}`,
        }}>
          {['RYTTER', 'ROLLE', 'KAT', 'PT'].map((h, i) => (
            <span key={h} style={{
              fontFamily: F, fontSize: 9, fontWeight: 700, color: T.t4,
              letterSpacing: '0.1em', textAlign: i >= 2 ? 'center' : 'left',
            }}>{h}</span>
          ))}
        </div>

        {riders.map((r, idx) => (
          <div key={idx} style={{
            display: 'grid', gridTemplateColumns: '1fr 80px 50px 50px',
            padding: '12px 18px', alignItems: 'center',
            borderBottom: idx < riders.length - 1 ? `1px solid ${T.border}` : 'none',
            transition: 'background 0.1s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = T.elevated }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
          >
            <div>
              <div style={{ fontFamily: F, fontSize: 12, fontWeight: 600, color: T.white }}>{r.name}</div>
              <div style={{ fontFamily: F, fontSize: 9, color: T.t3 }}>{r.team}</div>
            </div>
            <span style={{
              fontFamily: F, fontSize: 10, fontWeight: 600, color: T.t2,
              padding: '2px 8px', borderRadius: 6, background: T.elevated,
              border: `1px solid ${T.border}`,
            }}>{r.role}</span>
            <div style={{ textAlign: 'center' }}>
              <span style={{
                fontFamily: F, fontSize: 9, fontWeight: 800,
                color: catColors[r.cat] ?? T.t3,
                padding: '2px 6px', borderRadius: 4,
                background: `${catColors[r.cat] ?? T.t3}18`,
              }}>K{r.cat}</span>
            </div>
            <span style={{
              fontFamily: F, fontSize: 13, fontWeight: 800, textAlign: 'center',
              color: r.pts.startsWith('+') ? T.accent : T.t3,
            }}>{r.pts}</span>
          </div>
        ))}
      </div>
    </>
  )
}

// ─── Page ───────────────────────────────────────────────────

export default function GameroomPage() {
  const router = useRouter()
  const [tab, setTab] = useState<'football' | 'cycling'>('football')

  const heroStats = tab === 'football'
    ? { pts: '124', rank: '3.', played: '4/6', hit: '75%' }
    : { pts: '86', rank: '5.', played: '8/8', hit: '—' }

  return (
    <div style={{ fontFamily: F, background: T.bg, minHeight: '100vh', color: T.white }}>
      <Topbar
        onBack={() => router.push('/preview/dashboard')}
        title="Bodega Betting"
        subtitle="6 spillere · Block 3 · Uge 28"
      />

      <div style={{ display: 'flex', minHeight: 'calc(100vh - 56px)' }}>
        {/* Main */}
        <div style={{ flex: 1, padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Hero strip */}
          <div style={{
            background: `linear-gradient(135deg, ${T.surface} 0%, ${T.elevated} 100%)`,
            borderRadius: 14, padding: '16px 22px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            border: `1px solid ${T.border}`,
          }}>
            {[
              { v: heroStats.pts, l: 'POINT', c: T.accent },
              { v: heroStats.rank, l: 'PLADS', c: T.gold },
              { v: heroStats.played, l: 'SPILLET', c: T.white },
              { v: heroStats.hit, l: 'HIT RATE', c: T.white },
            ].map((s) => (
              <div key={s.l} style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: F, fontSize: 24, fontWeight: 800, color: s.c }}>{s.v}</div>
                <div style={{ fontFamily: F, fontSize: 8, color: T.t3, letterSpacing: '0.1em', marginTop: 2 }}>{s.l}</div>
              </div>
            ))}
          </div>

          {/* Sport toggle */}
          <div style={{
            display: 'flex', gap: 4, padding: 4,
            background: T.elevated, borderRadius: 12,
            border: `1px solid ${T.border}`,
            alignSelf: 'flex-start',
          }}>
            {[
              { id: 'football' as const, label: 'Fodbold', icon: <Trophy size={12} /> },
              { id: 'cycling' as const, label: 'Cykling', icon: <Bike size={12} /> },
            ].map((t) => (
              <div key={t.id} onClick={() => setTab(t.id)} style={{
                padding: '7px 16px', borderRadius: 8, cursor: 'pointer',
                background: tab === t.id ? T.accent : 'transparent',
                color: tab === t.id ? T.bg : T.t2,
                fontFamily: F, fontSize: 11, fontWeight: 700,
                display: 'flex', alignItems: 'center', gap: 5,
                transition: 'all 0.2s',
              }}>
                {t.icon} {t.label}
              </div>
            ))}
          </div>

          {/* Content */}
          {tab === 'football' ? <FootballContent /> : <CyclingContent />}
        </div>

        {/* Right panel */}
        <div style={{
          width: 280, background: T.surface,
          borderLeft: `1px solid ${T.border}`,
          padding: 20, display: 'flex', flexDirection: 'column', gap: 16,
        }}>
          {/* Leaderboard */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontFamily: F, fontSize: 12, fontWeight: 700 }}>Leaderboard</span>
              <span style={{
                fontFamily: F, fontSize: 9, fontWeight: 700, color: T.accent,
                padding: '3px 8px', borderRadius: 8, background: T.accentDim,
                display: 'flex', alignItems: 'center', gap: 3,
              }}>
                <Zap size={8} /> Live
              </span>
            </div>
            <LeaderboardRow rank={1} name="Jonas" pts={148} delta="+12" sub="5/6 rigtige" />
            <LeaderboardRow rank={2} name="Peter" pts={138} delta="—" sub="4/6 rigtige" />
            <LeaderboardRow rank={3} name="Mikkel" pts={124} delta="+8" sub="4/6 rigtige" me />
            <LeaderboardRow rank={4} name="Simon" pts={117} delta="-3" sub="3/6 rigtige" />
            <LeaderboardRow rank={5} name="Anders" pts={109} delta="-1" sub="3/6 rigtige" />
          </div>

          <div style={{ height: 1, background: T.border }} />

          {/* Consensus */}
          <div>
            <span style={{ fontFamily: F, fontSize: 12, fontWeight: 700, marginBottom: 10, display: 'block' }}>Konsensus</span>
            {[
              { match: 'Real Madrid vs Barça', pct: 66, label: '4/6 valgte Barça' },
              { match: 'Man City vs Arsenal', pct: 83, label: '5/6 valgte City' },
            ].map((c) => (
              <div key={c.match} style={{
                padding: '12px 14px', borderRadius: 10,
                background: T.elevated, border: `1px solid ${T.border}`,
                marginBottom: 8,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontFamily: F, fontSize: 10, fontWeight: 600, color: T.t2 }}>{c.match}</span>
                  <span style={{ fontFamily: F, fontSize: 11, fontWeight: 800, color: T.accent }}>{c.pct}%</span>
                </div>
                <div style={{ height: 4, borderRadius: 4, background: T.card }}>
                  <div style={{ height: '100%', borderRadius: 4, background: `linear-gradient(90deg, ${T.accent}, #00C853)`, width: `${c.pct}%`, transition: 'width 0.5s' }} />
                </div>
                <div style={{ fontFamily: F, fontSize: 9, color: T.t3, marginTop: 4 }}>{c.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
