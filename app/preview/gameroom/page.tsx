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

function MatchCard({ league, home, away, odds, picked }: {
  league: string; home: string; away: string
  odds: [string, string, string]; picked?: number
}) {
  return (
    <div style={{
      background: C.white, borderRadius: 14, padding: '14px 16px',
      border: `1px solid ${C.border}`,
      boxShadow: '0 2px 12px rgba(27,67,50,0.06)',
    }}>
      <div style={{ fontFamily: FONT, fontSize: 10, fontWeight: 600, color: C.muted, letterSpacing: '0.08em', marginBottom: 10 }}>
        {league}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontFamily: FONT, fontSize: 13, fontWeight: 700, color: C.charcoal }}>{home}</span>
        <span style={{ fontFamily: FONT, fontSize: 11, color: C.muted }}>vs</span>
        <span style={{ fontFamily: FONT, fontSize: 13, fontWeight: 700, color: C.charcoal }}>{away}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
        {['1', 'X', '2'].map((label, i) => {
          const isPicked = picked === i
          return (
            <div key={label} style={{
              background: isPicked ? C.greenDeep : C.bg,
              borderRadius: 8, padding: '6px 4px', textAlign: 'center', cursor: 'pointer',
            }}>
              <div style={{ fontSize: 9, color: isPicked ? C.greenLight : C.muted, marginBottom: 2 }}>{label}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: isPicked ? C.greenLight : C.charcoal }}>{odds[i]}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ConsensusBar({ home, away, pcts }: { home: string; away: string; pcts: [number, number, number] }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontFamily: FONT, fontSize: 11, fontWeight: 600, color: C.charcoal, marginBottom: 6 }}>
        {home} vs {away}
      </div>
      <div style={{ display: 'flex', height: 6, borderRadius: 3, overflow: 'hidden', gap: 1 }}>
        <div style={{ width: `${pcts[0]}%`, background: C.greenMid }} />
        <div style={{ width: `${pcts[1]}%`, background: C.warm }} />
        <div style={{ width: `${pcts[2]}%`, background: C.red }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
        <span style={{ fontFamily: FONT, fontSize: 9, color: C.muted }}>{pcts[0]}%</span>
        <span style={{ fontFamily: FONT, fontSize: 9, color: C.muted }}>{pcts[1]}%</span>
        <span style={{ fontFamily: FONT, fontSize: 9, color: C.muted }}>{pcts[2]}%</span>
      </div>
    </div>
  )
}

function LeaderboardRow({ rank, name, av, pts, delta, me }: {
  rank: number; name: string; av: string; pts: number; delta: string; me?: boolean
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '8px 10px', borderRadius: 10,
      background: me ? C.greenLight : 'transparent',
    }}>
      <span style={{
        fontFamily: FONT, fontSize: 12, fontWeight: 800, width: 18, textAlign: 'center',
        color: rank === 1 ? C.gold : rank === 2 ? '#94A3B8' : C.muted,
      }}>{rank}</span>
      <div style={{
        width: 26, height: 26, borderRadius: '50%',
        background: me ? C.greenDeep : C.greenLight,
        color: me ? C.greenLight : C.greenDeep,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 8, fontWeight: 800,
      }}>{av}</div>
      <span style={{ flex: 1, fontFamily: FONT, fontSize: 13, fontWeight: me ? 700 : 500, color: C.charcoal }}>{name}</span>
      <span style={{ fontFamily: FONT, fontSize: 14, fontWeight: 800, color: C.charcoal }}>{pts}</span>
      <span style={{
        fontFamily: FONT, fontSize: 10, fontWeight: 700, width: 28, textAlign: 'right',
        color: delta.startsWith('+') ? C.greenDark : delta.startsWith('-') ? C.red : C.muted,
      }}>{delta}</span>
    </div>
  )
}

export default function GameroomPage() {
  const router = useRouter()

  return (
    <div style={{ fontFamily: FONT, background: C.bg, minHeight: '100vh' }}>
      <Topbar
        onBack={() => router.push('/preview/dashboard')}
        breadcrumb={
          <span style={{ fontFamily: FONT, fontSize: 11, color: C.muted }}>
            Mine rum / <span style={{ fontWeight: 700, color: C.greenDark }}>Bodega Betting</span>
          </span>
        }
      />

      <div style={{ display: 'flex', minHeight: 'calc(100vh - 52px)' }}>
        {/* Main */}
        <div style={{ flex: 1, padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Hero */}
          <div style={{
            background: C.greenDeep, borderRadius: 20, padding: 24,
            position: 'relative', overflow: 'hidden',
          }}>
            <div style={{
              position: 'absolute', top: -60, right: -60,
              width: 240, height: 240, borderRadius: '50%',
              border: '1px solid rgba(116,198,157,0.08)', pointerEvents: 'none',
            }} />
            <div style={{
              position: 'absolute', top: -30, right: -30,
              width: 160, height: 160, borderRadius: '50%',
              border: '1px solid rgba(116,198,157,0.06)', pointerEvents: 'none',
            }} />
            <div style={{ position: 'relative' }}>
              <div style={{ fontFamily: FONT, fontSize: 10, fontWeight: 700, color: C.greenMid, letterSpacing: '0.1em', marginBottom: 6 }}>
                BLOCK 3 · UGE 28 · 9 KAMPE
              </div>
              <div style={{ fontFamily: FONT, fontSize: 24, fontWeight: 800, color: '#fff', marginBottom: 4 }}>
                Bodega Betting
              </div>
              <div style={{ fontFamily: FONT, fontSize: 12, color: C.muted, marginBottom: 18 }}>
                Bets lukker mandag · 3 kampe tilbage at spille
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                {[
                  { value: '124', label: 'DINE POINT' },
                  { value: '3.', label: 'PLADS' },
                  { value: '6/9', label: 'BETS LAGT' },
                ].map((s) => (
                  <div key={s.label} style={{
                    flex: 1, textAlign: 'center', padding: '10px 0',
                    borderRadius: 10, background: 'rgba(255,255,255,0.07)',
                  }}>
                    <div style={{ fontFamily: FONT, fontSize: 20, fontWeight: 800, color: '#fff' }}>{s.value}</div>
                    <div style={{ fontFamily: FONT, fontSize: 9, color: C.greenMid, marginTop: 2 }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Open matches */}
          <div>
            <div style={{ fontFamily: FONT, fontSize: 10, fontWeight: 700, color: C.muted, letterSpacing: '0.12em', marginBottom: 10 }}>
              ÅBNE KAMPE
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <MatchCard league="SUPERLIGA" home="FCK" away="Brøndby" odds={['1.85', '3.40', '4.10']} picked={0} />
              <MatchCard league="LA LIGA" home="Real Madrid" away="Barça" odds={['2.10', '3.30', '3.60']} picked={2} />
              <MatchCard league="PREMIER LEAGUE" home="Man City" away="Arsenal" odds={['1.60', '3.80', '5.50']} />
            </div>
          </div>
        </div>

        {/* Right panel */}
        <div style={{
          width: 300, background: C.surface,
          borderLeft: `1px solid ${C.border}`,
          padding: 20, display: 'flex', flexDirection: 'column', gap: 16,
        }}>
          {/* Consensus */}
          <div>
            <div style={{ fontFamily: FONT, fontSize: 12, fontWeight: 700, color: C.charcoal, marginBottom: 12 }}>
              Hvad tror de andre?
            </div>
            <ConsensusBar home="FCK" away="Brøndby" pcts={[55, 25, 20]} />
            <ConsensusBar home="Real Madrid" away="Barça" pcts={[35, 20, 45]} />
            <ConsensusBar home="Man City" away="Arsenal" pcts={[40, 30, 30]} />
          </div>

          <div style={{ height: 1, background: C.border }} />

          {/* Leaderboard */}
          <div>
            <div style={{ fontFamily: FONT, fontSize: 12, fontWeight: 700, color: C.charcoal, marginBottom: 10 }}>
              Leaderboard
            </div>
            <LeaderboardRow rank={1} name="Jonas" av="JR" pts={148} delta="+12" />
            <LeaderboardRow rank={2} name="Peter" av="PL" pts={138} delta="—" />
            <LeaderboardRow rank={3} name="Mikkel" av="MK" pts={124} delta="+8" me />
          </div>

          {/* CTA */}
          <div
            onClick={() => router.push('/preview/gameroom/bets')}
            style={{
              background: C.greenDeep, color: C.greenLight,
              borderRadius: 10, padding: 12, textAlign: 'center',
              fontFamily: FONT, fontSize: 13, fontWeight: 700,
              cursor: 'pointer', marginTop: 'auto',
            }}
          >
            Se mine bets →
          </div>
        </div>
      </div>
    </div>
  )
}
