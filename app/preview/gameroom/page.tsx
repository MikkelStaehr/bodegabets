'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft, ChevronRight, Target, Award, BarChart3 } from 'lucide-react'

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
          cursor: 'pointer', color: C.greenLight,
        }}
      >
        <ArrowLeft size={14} />
      </div>
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

function MatchCard({ league, leagueLogo, home, away, homeLogo, awayLogo, odds, picked }: {
  league: string; leagueLogo?: string; home: string; away: string
  homeLogo?: string; awayLogo?: string
  odds: [string, string, string]; picked?: number
}) {
  return (
    <div style={{
      background: C.white, borderRadius: 16, padding: '16px 18px',
      border: `1px solid ${C.border}`,
      boxShadow: '0 2px 12px rgba(27,67,50,0.06)',
    }}>
      {/* League */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
        {leagueLogo && <img src={leagueLogo} alt="" style={{ width: 14, height: 14, objectFit: 'contain' }} />}
        <span style={{ fontFamily: FONT, fontSize: 10, fontWeight: 600, color: C.muted, letterSpacing: '0.06em' }}>{league}</span>
      </div>

      {/* Teams */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {homeLogo ? (
            <img src={homeLogo} alt="" style={{ width: 28, height: 28, objectFit: 'contain' }} />
          ) : (
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: C.greenLight, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, color: C.greenDeep }}>{home.slice(0, 3)}</div>
          )}
          <span style={{ fontFamily: FONT, fontSize: 14, fontWeight: 700, color: C.charcoal }}>{home}</span>
        </div>
        <span style={{ fontFamily: FONT, fontSize: 10, fontWeight: 600, color: C.muted, padding: '2px 8px', background: C.bg, borderRadius: 6 }}>VS</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontFamily: FONT, fontSize: 14, fontWeight: 700, color: C.charcoal }}>{away}</span>
          {awayLogo ? (
            <img src={awayLogo} alt="" style={{ width: 28, height: 28, objectFit: 'contain' }} />
          ) : (
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: C.greenLight, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, color: C.greenDeep }}>{away.slice(0, 3)}</div>
          )}
        </div>
      </div>

      {/* Odds */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
        {['1', 'X', '2'].map((label, i) => {
          const isPicked = picked === i
          return (
            <div key={label} style={{
              background: isPicked ? C.greenDeep : C.bg,
              borderRadius: 10, padding: '8px 4px', textAlign: 'center', cursor: 'pointer',
              transition: 'all 0.15s',
              border: isPicked ? `1px solid ${C.greenDeep}` : '1px solid transparent',
            }}>
              <div style={{ fontSize: 9, color: isPicked ? C.greenMid : C.muted, fontWeight: 600, marginBottom: 3 }}>{label}</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: isPicked ? '#fff' : C.charcoal }}>{odds[i]}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ConsensusBar({ home, away, pcts }: { home: string; away: string; pcts: [number, number, number] }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontFamily: FONT, fontSize: 11, fontWeight: 600, color: C.charcoal, marginBottom: 6 }}>
        {home} vs {away}
      </div>
      <div style={{ display: 'flex', height: 6, borderRadius: 3, overflow: 'hidden', gap: 1 }}>
        <div style={{ width: `${pcts[0]}%`, background: C.greenMid, transition: 'width 0.5s' }} />
        <div style={{ width: `${pcts[1]}%`, background: C.warm, transition: 'width 0.5s' }} />
        <div style={{ width: `${pcts[2]}%`, background: C.red, transition: 'width 0.5s' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
        {['1', 'X', '2'].map((l, i) => (
          <span key={l} style={{ fontFamily: FONT, fontSize: 9, color: C.muted }}>{l}: {pcts[i]}%</span>
        ))}
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
      padding: '9px 10px', borderRadius: 10,
      background: me ? C.greenLight : 'transparent',
      transition: 'background 0.15s',
    }}>
      <span style={{
        fontFamily: FONT, fontSize: 12, fontWeight: 800, width: 18, textAlign: 'center',
        color: rank === 1 ? C.gold : rank === 2 ? '#94A3B8' : C.muted,
      }}>{rank}</span>
      <div style={{
        width: 28, height: 28, borderRadius: '50%',
        background: me ? C.greenDeep : C.greenLight,
        color: me ? C.greenLight : C.greenDeep,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 9, fontWeight: 800,
      }}>{av}</div>
      <span style={{ flex: 1, fontFamily: FONT, fontSize: 13, fontWeight: me ? 700 : 500, color: C.charcoal }}>
        {name}{me ? ' ◂' : ''}
      </span>
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
        <div style={{ flex: 1, padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Hero */}
          <div style={{
            background: `linear-gradient(135deg, ${C.greenDeep} 0%, #244E3D 100%)`,
            borderRadius: 20, padding: 28,
            position: 'relative', overflow: 'hidden',
          }}>
            <div style={{ position: 'absolute', top: -50, right: -50, width: 200, height: 200, borderRadius: '50%', border: '1px solid rgba(116,198,157,0.08)' }} />
            <div style={{ position: 'absolute', top: -20, right: -20, width: 120, height: 120, borderRadius: '50%', border: '1px solid rgba(116,198,157,0.06)' }} />
            <div style={{ position: 'relative' }}>
              <div style={{ fontFamily: FONT, fontSize: 10, fontWeight: 700, color: C.greenMid, letterSpacing: '0.1em', marginBottom: 8 }}>
                BLOCK 3 · UGE 28 · 9 KAMPE
              </div>
              <div style={{ fontFamily: FONT, fontSize: 26, fontWeight: 800, color: '#fff', marginBottom: 6 }}>
                Bodega Betting
              </div>
              <div style={{ fontFamily: FONT, fontSize: 12, color: C.muted, marginBottom: 20 }}>
                Bets lukker mandag · 3 kampe tilbage at spille
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                {[
                  { value: '124', label: 'DINE POINT', icon: <Target size={14} color={C.greenMid} /> },
                  { value: '3.', label: 'PLADS', icon: <Award size={14} color={C.greenMid} /> },
                  { value: '6/9', label: 'BETS LAGT', icon: <BarChart3 size={14} color={C.greenMid} /> },
                ].map((s) => (
                  <div key={s.label} style={{
                    flex: 1, textAlign: 'center', padding: '12px 0',
                    borderRadius: 12, background: 'rgba(255,255,255,0.07)',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 4 }}>{s.icon}</div>
                    <div style={{ fontFamily: FONT, fontSize: 22, fontWeight: 800, color: '#fff' }}>{s.value}</div>
                    <div style={{ fontFamily: FONT, fontSize: 8, color: C.greenMid, marginTop: 2, letterSpacing: '0.06em' }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Open matches */}
          <div>
            <div style={{ fontFamily: FONT, fontSize: 10, fontWeight: 700, color: C.muted, letterSpacing: '0.12em', marginBottom: 12 }}>
              ÅBNE KAMPE
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
              <MatchCard league="SUPERLIGA" leagueLogo={`${B}/3f-superliga.png`} home="FCK" away="Brøndby" homeLogo={`${B}/fc-koebenhavn.png`} awayLogo={`${B}/broendby-if.png`} odds={['1.85', '3.40', '4.10']} picked={0} />
              <MatchCard league="LA LIGA" leagueLogo={`${B}/la-liga.png`} home="Real Madrid" away="Barça" homeLogo={`${B}/real-madrid.png`} awayLogo={`${B}/fc-barcelona.png`} odds={['2.10', '3.30', '3.60']} picked={2} />
              <MatchCard league="PREMIER LEAGUE" leagueLogo={`${B}/premier-league.png`} home="Man City" away="Arsenal" homeLogo={`${B}/manchester-city.png`} awayLogo={`${B}/arsenal.png`} odds={['1.60', '3.80', '5.50']} />
            </div>
          </div>
        </div>

        {/* Right panel */}
        <div style={{
          width: 300, background: C.surface,
          borderLeft: `1px solid ${C.border}`,
          padding: 20, display: 'flex', flexDirection: 'column', gap: 16,
        }}>
          <div>
            <div style={{ fontFamily: FONT, fontSize: 12, fontWeight: 700, color: C.charcoal, marginBottom: 14 }}>
              Hvad tror de andre?
            </div>
            <ConsensusBar home="FCK" away="Brøndby" pcts={[55, 25, 20]} />
            <ConsensusBar home="Real Madrid" away="Barça" pcts={[35, 20, 45]} />
            <ConsensusBar home="Man City" away="Arsenal" pcts={[40, 30, 30]} />
          </div>

          <div style={{ height: 1, background: C.border }} />

          <div>
            <div style={{ fontFamily: FONT, fontSize: 12, fontWeight: 700, color: C.charcoal, marginBottom: 10 }}>
              Leaderboard
            </div>
            <LeaderboardRow rank={1} name="Jonas" av="JR" pts={148} delta="+12" />
            <LeaderboardRow rank={2} name="Peter" av="PL" pts={138} delta="—" />
            <LeaderboardRow rank={3} name="Mikkel" av="MK" pts={124} delta="+8" me />
          </div>

          <div
            onClick={() => router.push('/preview/gameroom/bets')}
            style={{
              background: C.greenDeep, color: C.greenLight,
              borderRadius: 12, padding: '13px 16px',
              fontFamily: FONT, fontSize: 13, fontWeight: 700,
              cursor: 'pointer', marginTop: 'auto',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              transition: 'opacity 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.9' }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = '1' }}
          >
            Se mine bets <ChevronRight size={16} />
          </div>
        </div>
      </div>
    </div>
  )
}
