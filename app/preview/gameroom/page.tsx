'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, Trophy, Bike, Check, X, Minus, Lock, Users, Clock, Route, Mountain, TrendingUp, ChevronDown, Star } from 'lucide-react'

const T = {
  bg: '#F6F3EE',
  sand: '#EDE9E1',
  cream: '#FDFBF7',
  white: '#FFFFFF',
  olive: '#5C6B55',
  oliveMuted: '#8A9683',
  oliveLight: '#E8EDE5',
  olivePale: '#F2F5F0',
  sage: '#A3B899',
  sageDeep: '#3D4F35',
  terracotta: '#C4705A',
  terracottaLight: '#F5E6E1',
  sky: '#7BA7C2',
  skyLight: '#E4F0F7',
  skyDeep: '#2D5F7A',
  warm: '#B8A88A',
  warmLight: '#F0EBE1',
  ink: '#2D2A26',
  t2: '#6B665E',
  t3: '#9E9890',
  border: '#E5E0D8',
  borderLight: '#EDEBE6',
  green: '#5C8A5E',
  greenLight: '#EAF2EA',
  red: '#C4705A',
  redLight: '#F5E6E1',
}
const F = "'Plus Jakarta Sans', sans-serif"
const B = 'https://bold.dk/img/tag/64x64'

// ─── Shared ─────────────────────────────────────────────────

function Topbar({ onBack, title, sub }: { onBack: () => void; title: string; sub: string }) {
  return (
    <div style={{
      height: 60, display: 'flex', alignItems: 'center',
      padding: '0 28px', gap: 14,
      background: T.cream, borderBottom: `1px solid ${T.border}`,
    }}>
      <div onClick={onBack} style={{
        width: 34, height: 34, borderRadius: 12,
        background: T.sand, border: `1px solid ${T.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', color: T.t2,
      }}>
        <ArrowLeft size={15} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: F, fontSize: 15, fontWeight: 800, color: T.ink }}>{title}</div>
        <div style={{ fontFamily: F, fontSize: 10, color: T.t3 }}>{sub}</div>
      </div>
      <div style={{
        width: 36, height: 36, borderRadius: '50%',
        background: `linear-gradient(135deg, ${T.sage}, ${T.olive})`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 12, fontWeight: 800, color: '#fff',
      }}>MS</div>
    </div>
  )
}

function StatBox({ value, label, color }: { value: string; label: string; color?: string }) {
  return (
    <div style={{
      background: T.white, borderRadius: 14, padding: '14px 12px',
      border: `1px solid ${T.border}`, textAlign: 'center',
      flex: 1,
    }}>
      <div style={{ fontFamily: F, fontSize: 22, fontWeight: 800, color: color ?? T.ink, lineHeight: 1 }}>{value}</div>
      <div style={{ fontFamily: F, fontSize: 8, color: T.t3, marginTop: 4, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{label}</div>
    </div>
  )
}

function LeaderboardRow({ rank, name, pts, delta, sub, me }: {
  rank: number; name: string; pts: number; delta: string; sub?: string; me?: boolean
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 12px', borderRadius: 12,
      background: me ? T.olivePale : 'transparent',
    }}>
      <span style={{
        fontFamily: F, fontSize: 13, fontWeight: 800, width: 18,
        color: rank === 1 ? '#D4A843' : rank === 2 ? '#A0A0A0' : rank === 3 ? '#B87333' : T.t3,
      }}>{rank}</span>
      <div style={{
        width: 28, height: 28, borderRadius: '50%',
        background: me ? T.sageDeep : T.sand,
        color: me ? T.oliveLight : T.t2,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 9, fontWeight: 800,
      }}>{name.slice(0, 2).toUpperCase()}</div>
      <div style={{ flex: 1 }}>
        <span style={{ fontFamily: F, fontSize: 12, fontWeight: me ? 700 : 500, color: T.ink }}>{name}</span>
        {sub && <div style={{ fontFamily: F, fontSize: 9, color: T.t3 }}>{sub}</div>}
      </div>
      <span style={{ fontFamily: F, fontSize: 14, fontWeight: 800, color: T.ink }}>{pts}</span>
      <span style={{
        fontFamily: F, fontSize: 10, fontWeight: 700, width: 28, textAlign: 'right',
        color: delta.startsWith('+') ? T.green : delta.startsWith('-') ? T.red : T.t3,
      }}>{delta}</span>
    </div>
  )
}

// ─── Football Gameroom ──────────────────────────────────────

const footballBets = [
  { home: 'FCK', away: 'Brøndby', hL: `${B}/fc-koebenhavn.png`, aL: `${B}/broendby-if.png`, league: 'Superliga', pick: 'FCK', odds: '1.85', status: 'won', pts: '+22', score: '2 – 1' },
  { home: 'Liverpool', away: 'Man Utd', hL: `${B}/liverpool.png`, aL: `${B}/manchester-united.png`, league: 'Premier League', pick: 'Liverpool', odds: '1.60', status: 'lost', pts: '0', score: '1 – 2' },
  { home: 'Bayern', away: 'Dortmund', hL: `${B}/bayern-muenchen.png`, aL: `${B}/borussia-dortmund.png`, league: 'Bundesliga', pick: 'Bayern', odds: '1.70', status: 'won', pts: '+18', score: '3 – 0' },
  { home: 'PSG', away: 'Marseille', hL: `${B}/paris-saint-germain.png`, aL: `${B}/olympique-marseille.png`, league: 'Ligue 1', pick: 'PSG', odds: '1.45', status: 'won', pts: '+14', score: '2 – 0' },
  { home: 'Real Madrid', away: 'Barcelona', hL: `${B}/real-madrid.png`, aL: `${B}/fc-barcelona.png`, league: 'La Liga', pick: 'Barça', odds: '3.60', status: 'open', pts: '—', score: '—' },
  { home: 'Man City', away: 'Arsenal', hL: `${B}/manchester-city.png`, aL: `${B}/arsenal.png`, league: 'Premier League', pick: 'City', odds: '1.60', status: 'open', pts: '—', score: '—' },
]

function FootballGameroom() {
  return (
    <>
      {/* Stats row */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <StatBox value="124" label="Point" color={T.olive} />
        <StatBox value="3." label="Placering" color={T.sageDeep} />
        <StatBox value="4/6" label="Rigtige" />
        <StatBox value="75%" label="Hit rate" color={T.sage} />
      </div>

      {/* Round selector */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div>
          <div style={{ fontFamily: F, fontSize: 16, fontWeight: 800, color: T.ink }}>Uge 28</div>
          <div style={{ fontFamily: F, fontSize: 11, color: T.t3 }}>6 kampe · 4 afsluttet · 2 åbne</div>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 4,
          padding: '6px 12px', borderRadius: 10,
          background: T.white, border: `1px solid ${T.border}`,
          fontFamily: F, fontSize: 11, fontWeight: 600, color: T.t2, cursor: 'pointer',
        }}>
          Skift runde <ChevronDown size={13} />
        </div>
      </div>

      {/* Bets */}
      <div style={{
        background: T.white, borderRadius: 18,
        border: `1px solid ${T.border}`, overflow: 'hidden',
      }}>
        {footballBets.map((bet, idx) => (
          <div key={idx} style={{
            padding: '14px 20px',
            borderBottom: idx < footballBets.length - 1 ? `1px solid ${T.borderLight}` : 'none',
            display: 'flex', alignItems: 'center', gap: 14,
            transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = T.olivePale }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
          >
            {/* Status */}
            <div style={{
              width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
              background: bet.status === 'won' ? T.greenLight : bet.status === 'lost' ? T.redLight : T.warmLight,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: bet.status === 'won' ? T.green : bet.status === 'lost' ? T.red : T.warm,
            }}>
              {bet.status === 'won' ? <Check size={12} strokeWidth={3} /> : bet.status === 'lost' ? <X size={12} strokeWidth={3} /> : <Minus size={12} />}
            </div>

            {/* Teams */}
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10 }}>
              <img src={bet.hL} alt="" style={{ width: 22, height: 22, objectFit: 'contain' }} />
              <div>
                <div style={{ fontFamily: F, fontSize: 13, fontWeight: 600, color: T.ink }}>
                  {bet.home} <span style={{ color: T.t3, fontWeight: 400 }}>–</span> {bet.away}
                </div>
                <div style={{ fontFamily: F, fontSize: 9, color: T.t3 }}>{bet.league}</div>
              </div>
              <img src={bet.aL} alt="" style={{ width: 22, height: 22, objectFit: 'contain' }} />
            </div>

            {/* Score */}
            <span style={{
              fontFamily: F, fontSize: 13, fontWeight: 700,
              color: bet.score === '—' ? T.t3 : T.ink,
              width: 48, textAlign: 'center',
            }}>{bet.score}</span>

            {/* Pick */}
            <span style={{
              fontFamily: F, fontSize: 10, fontWeight: 700, color: T.olive,
              padding: '4px 10px', borderRadius: 8, background: T.oliveLight,
              minWidth: 48, textAlign: 'center',
            }}>{bet.pick}</span>

            {/* Odds */}
            <span style={{ fontFamily: F, fontSize: 11, color: T.t3, width: 36, textAlign: 'center' }}>{bet.odds}</span>

            {/* Points */}
            <span style={{
              fontFamily: F, fontSize: 15, fontWeight: 800, width: 40, textAlign: 'right',
              color: bet.pts.startsWith('+') ? T.green : bet.pts === '0' ? T.red : T.t3,
            }}>{bet.pts}</span>
          </div>
        ))}
      </div>
    </>
  )
}

// ─── Cycling Gameroom ───────────────────────────────────────

const riders = [
  { name: 'Pogačar', team: 'UAE Emirates', role: 'Leader', cat: 1, pts: '+32', pos: '1.' },
  { name: 'van der Poel', team: 'Alpecin-Deceuninck', role: 'Grimpeur', cat: 1, pts: '+28', pos: '3.' },
  { name: 'van Aert', team: 'Visma-Lease a Bike', role: 'Sprinter', cat: 1, pts: '+18', pos: '7.' },
  { name: 'Pedersen', team: 'Lidl-Trek', role: 'Lieutenant', cat: 2, pts: '+14', pos: '12.' },
  { name: 'Küng', team: 'Groupama-FDJ', role: 'Domestique', cat: 4, pts: '+5', pos: '34.' },
  { name: 'Lampaert', team: 'Soudal Quick-Step', role: 'Équipier', cat: 3, pts: '+8', pos: '21.' },
  { name: 'Stuyven', team: 'Lidl-Trek', role: 'Équipier', cat: 3, pts: '+6', pos: '28.' },
  { name: 'Philipsen', team: 'Alpecin-Deceuninck', role: 'Joker', cat: 2, pts: '—', pos: 'DNF' },
]

const catColors: Record<number, { bg: string; text: string }> = {
  1: { bg: '#FEF3C7', text: '#92400E' },
  2: { bg: T.oliveLight, text: T.sageDeep },
  3: { bg: T.skyLight, text: T.skyDeep },
  4: { bg: T.warmLight, text: '#7A6841' },
}

function CyclingGameroom() {
  return (
    <>
      {/* Race header */}
      <div style={{
        background: T.white, borderRadius: 18,
        border: `1px solid ${T.border}`,
        overflow: 'hidden', marginBottom: 16,
      }}>
        <div style={{
          height: 6,
          background: `linear-gradient(90deg, ${T.sky}, ${T.skyDeep})`,
        }} />
        <div style={{ padding: '20px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <div style={{ fontFamily: F, fontSize: 10, fontWeight: 700, color: T.t3, letterSpacing: '0.1em' }}>ARDENNERNE · SØNDAG 12. APR</div>
              <div style={{ fontFamily: F, fontSize: 22, fontWeight: 800, color: T.ink, marginTop: 4 }}>Paris–Roubaix</div>
              <div style={{ fontFamily: F, fontSize: 12, color: T.t3, marginTop: 2 }}>Compiègne → Roubaix</div>
            </div>
            <span style={{
              fontFamily: F, fontSize: 10, fontWeight: 700, color: T.terracotta,
              padding: '5px 12px', borderRadius: 10, background: T.terracottaLight,
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              <Lock size={10} /> Låser lør 10:00
            </span>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            {[
              { icon: <Route size={13} />, value: '258 km', label: 'Distance' },
              { icon: <Mountain size={13} />, value: 'Brosten', label: 'Profil' },
              { icon: <TrendingUp size={13} />, value: '1.288 m', label: 'Højde' },
              { icon: <Star size={13} />, value: 'PS 14', label: 'Score' },
            ].map((s) => (
              <div key={s.label} style={{
                flex: 1, padding: '10px 8px', borderRadius: 12,
                background: T.bg, textAlign: 'center',
              }}>
                <div style={{ display: 'flex', justifyContent: 'center', color: T.sky, marginBottom: 4 }}>{s.icon}</div>
                <div style={{ fontFamily: F, fontSize: 14, fontWeight: 800, color: T.ink }}>{s.value}</div>
                <div style={{ fontFamily: F, fontSize: 8, color: T.t3, marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <StatBox value="86" label="Point" color={T.sky} />
        <StatBox value="5." label="Placering" color={T.skyDeep} />
        <StatBox value="8/8" label="Lineup" />
      </div>

      {/* Lineup */}
      <div style={{
        background: T.white, borderRadius: 18,
        border: `1px solid ${T.border}`, overflow: 'hidden',
      }}>
        <div style={{
          display: 'grid', gridTemplateColumns: '32px 1fr 80px 44px 44px',
          padding: '10px 20px', borderBottom: `1px solid ${T.borderLight}`,
        }}>
          {['#', 'RYTTER', 'ROLLE', 'KAT', 'PT'].map((h, i) => (
            <span key={h} style={{
              fontFamily: F, fontSize: 9, fontWeight: 700, color: T.t3,
              letterSpacing: '0.1em', textAlign: i >= 3 ? 'center' : 'left',
            }}>{h}</span>
          ))}
        </div>

        {riders.map((r, idx) => {
          const cc = catColors[r.cat]
          return (
            <div key={idx} style={{
              display: 'grid', gridTemplateColumns: '32px 1fr 80px 44px 44px',
              padding: '13px 20px', alignItems: 'center',
              borderBottom: idx < riders.length - 1 ? `1px solid ${T.borderLight}` : 'none',
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = T.olivePale }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
            >
              <span style={{ fontFamily: F, fontSize: 11, fontWeight: 600, color: r.pos === 'DNF' ? T.red : T.t3 }}>{r.pos}</span>
              <div>
                <div style={{ fontFamily: F, fontSize: 13, fontWeight: 600, color: T.ink }}>{r.name}</div>
                <div style={{ fontFamily: F, fontSize: 9, color: T.t3 }}>{r.team}</div>
              </div>
              <span style={{
                fontFamily: F, fontSize: 10, fontWeight: 600, color: T.t2,
                padding: '3px 8px', borderRadius: 8, background: T.bg,
              }}>{r.role}</span>
              <div style={{ textAlign: 'center' }}>
                <span style={{
                  fontFamily: F, fontSize: 9, fontWeight: 800,
                  color: cc.text, padding: '2px 7px', borderRadius: 6,
                  background: cc.bg,
                }}>K{r.cat}</span>
              </div>
              <span style={{
                fontFamily: F, fontSize: 14, fontWeight: 800, textAlign: 'center',
                color: r.pts.startsWith('+') ? T.green : r.pts === 'DNF' ? T.red : T.t3,
              }}>{r.pts}</span>
            </div>
          )
        })}
      </div>
    </>
  )
}

// ─── Page ───────────────────────────────────────────────────

export default function GameroomPage() {
  const router = useRouter()
  const params = useSearchParams()
  const sport = params.get('sport') === 'cycling' ? 'cycling' : 'football'

  const title = sport === 'football' ? 'Bodega Betting' : 'Fantasy Manager'
  const sub = sport === 'football' ? '6 spillere · Block 3 · Uge 28' : '4 spillere · Ardennerne'

  return (
    <div style={{ fontFamily: F, background: T.bg, minHeight: '100vh' }}>
      <Topbar onBack={() => router.push('/preview/dashboard')} title={title} sub={sub} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', minHeight: 'calc(100vh - 60px)' }}>
        {/* Main */}
        <div style={{ padding: '24px 28px' }}>
          {sport === 'football' ? <FootballGameroom /> : <CyclingGameroom />}
        </div>

        {/* Right panel */}
        <div style={{
          background: T.cream, borderLeft: `1px solid ${T.border}`,
          padding: '24px 22px', display: 'flex', flexDirection: 'column', gap: 16,
        }}>
          {/* Leaderboard */}
          <div style={{
            background: T.white, borderRadius: 18, padding: '18px 16px',
            border: `1px solid ${T.border}`,
          }}>
            <div style={{ fontFamily: F, fontSize: 13, fontWeight: 700, color: T.ink, marginBottom: 12 }}>
              Leaderboard
            </div>
            <LeaderboardRow rank={1} name="Jonas" pts={148} delta="+12" sub="5/6 rigtige" />
            <LeaderboardRow rank={2} name="Peter" pts={138} delta="—" sub="4/6 rigtige" />
            <LeaderboardRow rank={3} name="Mikkel" pts={124} delta="+8" sub="4/6 rigtige" me />
            <LeaderboardRow rank={4} name="Simon" pts={117} delta="-3" sub="3/6 rigtige" />
            <LeaderboardRow rank={5} name="Anders" pts={109} delta="-1" sub="3/6 rigtige" />
          </div>

          {/* Consensus */}
          <div style={{
            background: T.white, borderRadius: 18, padding: '18px 16px',
            border: `1px solid ${T.border}`,
          }}>
            <div style={{ fontFamily: F, fontSize: 13, fontWeight: 700, color: T.ink, marginBottom: 12 }}>
              Konsensus · åbne kampe
            </div>
            {[
              { match: 'Real Madrid – Barça', pct: 66, label: '4/6 valgte Barça', color: T.olive },
              { match: 'Man City – Arsenal', pct: 83, label: '5/6 valgte City', color: T.sage },
            ].map((c) => (
              <div key={c.match} style={{
                padding: '12px 14px', borderRadius: 12,
                background: T.bg, marginBottom: 8,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontFamily: F, fontSize: 11, fontWeight: 600, color: T.ink }}>{c.match}</span>
                  <span style={{ fontFamily: F, fontSize: 12, fontWeight: 800, color: c.color }}>{c.pct}%</span>
                </div>
                <div style={{ height: 4, borderRadius: 4, background: T.border }}>
                  <div style={{ height: '100%', borderRadius: 4, background: c.color, width: `${c.pct}%`, transition: 'width 0.5s' }} />
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
