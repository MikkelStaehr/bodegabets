'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Zap, ChevronRight, Trophy, Bike, Clock, Flame, TrendingUp, Star, Users } from 'lucide-react'

// ─── Dark premium tokens ────────────────────────────────────

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
  white: '#FFFFFF',
  t1: '#F5F5F5',
  t2: '#9CA3AF',
  t3: '#6B7280',
  t4: '#3B3F45',
}
const F = "'Plus Jakarta Sans', sans-serif"
const B = 'https://bold.dk/img/tag/64x64'

// ─── Helpers ────────────────────────────────────────────────

function Glass({ children, style, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div style={{
      background: T.surface,
      border: `1px solid ${T.border}`,
      borderRadius: 16,
      backdropFilter: 'blur(20px)',
      ...style,
    }} {...props}>
      {children}
    </div>
  )
}

function Stat({ value, label, accent }: { value: string; label: string; accent?: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontFamily: F, fontSize: 28, fontWeight: 800, color: accent ?? T.white, lineHeight: 1 }}>{value}</div>
      <div style={{ fontFamily: F, fontSize: 9, fontWeight: 600, color: T.t3, letterSpacing: '0.1em', marginTop: 4, textTransform: 'uppercase' }}>{label}</div>
    </div>
  )
}

// ─── Components ─────────────────────────────────────────────

function Topbar() {
  return (
    <div style={{
      height: 56, display: 'flex', alignItems: 'center',
      padding: '0 28px', gap: 16,
      borderBottom: `1px solid ${T.border}`,
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: 10,
        background: `linear-gradient(135deg, ${T.accent}, #00C853)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 12, fontWeight: 900, color: T.bg,
      }}>B</div>
      <span style={{ fontFamily: F, fontSize: 17, fontWeight: 800, color: T.white, flex: 1 }}>
        bodega<span style={{ color: T.accent }}>.</span>bets
      </span>
      <div style={{
        padding: '5px 12px', borderRadius: 20,
        background: T.accentDim, border: `1px solid rgba(0,230,118,0.15)`,
        fontFamily: F, fontSize: 10, fontWeight: 700, color: T.accent,
        display: 'flex', alignItems: 'center', gap: 5,
      }}>
        <Zap size={10} /> LIVE
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

function LiveMatchHero() {
  return (
    <div style={{
      background: `linear-gradient(135deg, ${T.surface} 0%, #151A1E 50%, ${T.surface} 100%)`,
      borderRadius: 20, padding: '28px 32px',
      position: 'relative', overflow: 'hidden',
      border: `1px solid ${T.border}`,
    }}>
      {/* Glow */}
      <div style={{
        position: 'absolute', top: -100, left: '50%', transform: 'translateX(-50%)',
        width: 400, height: 400, borderRadius: '50%',
        background: `radial-gradient(circle, ${T.accentGlow} 0%, transparent 70%)`,
        pointerEvents: 'none',
      }} />

      <div style={{ position: 'relative' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Flame size={14} color={T.accent} />
            <span style={{ fontFamily: F, fontSize: 10, fontWeight: 700, color: T.accent, letterSpacing: '0.12em' }}>FEATURED MATCH</span>
          </div>
          <span style={{
            fontFamily: F, fontSize: 10, fontWeight: 600, color: T.t3,
            padding: '4px 10px', borderRadius: 8, background: T.elevated,
          }}>
            Søndag 13:00
          </span>
        </div>

        {/* Teams */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 40, marginBottom: 28 }}>
          <div style={{ textAlign: 'center' }}>
            <img src={`${B}/fc-koebenhavn.png`} alt="" style={{ width: 64, height: 64, objectFit: 'contain', marginBottom: 10 }} />
            <div style={{ fontFamily: F, fontSize: 18, fontWeight: 800, color: T.white }}>FCK</div>
            <div style={{ fontFamily: F, fontSize: 10, color: T.t3, marginTop: 2 }}>Hjemme</div>
          </div>

          <div style={{ textAlign: 'center' }}>
            <div style={{
              fontFamily: F, fontSize: 11, fontWeight: 700, color: T.t4,
              padding: '6px 14px', borderRadius: 8, background: T.elevated,
              border: `1px solid ${T.border}`,
            }}>VS</div>
          </div>

          <div style={{ textAlign: 'center' }}>
            <img src={`${B}/broendby-if.png`} alt="" style={{ width: 64, height: 64, objectFit: 'contain', marginBottom: 10 }} />
            <div style={{ fontFamily: F, fontSize: 18, fontWeight: 800, color: T.white }}>Brøndby</div>
            <div style={{ fontFamily: F, fontSize: 10, color: T.t3, marginTop: 2 }}>Ude</div>
          </div>
        </div>

        {/* Odds */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          {[
            { label: '1', odds: '1.85', picked: true },
            { label: 'X', odds: '3.40', picked: false },
            { label: '2', odds: '4.10', picked: false },
          ].map((o) => (
            <div key={o.label} style={{
              padding: '12px 8px', borderRadius: 12, textAlign: 'center', cursor: 'pointer',
              background: o.picked ? T.accent : T.elevated,
              border: `1px solid ${o.picked ? T.accent : T.border}`,
              transition: 'all 0.2s',
            }}>
              <div style={{ fontFamily: F, fontSize: 9, fontWeight: 600, color: o.picked ? T.bg : T.t3, marginBottom: 4 }}>{o.label}</div>
              <div style={{ fontFamily: F, fontSize: 22, fontWeight: 800, color: o.picked ? T.bg : T.white }}>{o.odds}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function RoomCard({ name, sport, icon, rank, badge, badgeColor, onClick }: {
  name: string; sport: string; icon: React.ReactNode
  rank: string; badge: string; badgeColor: string
  onClick?: () => void
}) {
  const [hovered, setHovered] = useState(false)
  return (
    <Glass
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: 0, cursor: 'pointer', overflow: 'hidden',
        transform: hovered ? 'translateY(-4px)' : 'none',
        boxShadow: hovered ? `0 12px 40px rgba(0,0,0,0.4)` : 'none',
        transition: 'transform 0.2s, box-shadow 0.2s',
      }}
    >
      <div style={{
        padding: '20px 20px 16px',
        background: `linear-gradient(180deg, ${T.elevated} 0%, ${T.surface} 100%)`,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: T.accentDim,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: T.accent,
          }}>{icon}</div>
          <span style={{
            fontFamily: F, fontSize: 9, fontWeight: 700,
            padding: '3px 10px', borderRadius: 20,
            background: badgeColor, color: T.white,
            letterSpacing: '0.06em',
          }}>{badge}</span>
        </div>
        <div style={{ fontFamily: F, fontSize: 16, fontWeight: 800, color: T.white, marginBottom: 4 }}>{name}</div>
        <div style={{ fontFamily: F, fontSize: 11, color: T.t3 }}>{sport}</div>
      </div>
      <div style={{
        padding: '12px 20px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        borderTop: `1px solid ${T.border}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Users size={12} color={T.t3} />
          <span style={{ fontFamily: F, fontSize: 11, color: T.t3 }}>6 spillere</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontFamily: F, fontSize: 12, fontWeight: 700, color: T.accent }}>{rank}</span>
          <ChevronRight size={14} color={T.t3} />
        </div>
      </div>
    </Glass>
  )
}

// ─── Page ───────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter()

  return (
    <div style={{ fontFamily: F, background: T.bg, minHeight: '100vh', color: T.white }}>
      <Topbar />

      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '32px 28px' }}>
        {/* Greeting */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 28, fontWeight: 800, lineHeight: 1.2 }}>
            Velkommen, <span style={{ color: T.accent }}>Mikkel</span>
          </div>
          <div style={{ fontSize: 13, color: T.t3, marginTop: 6 }}>
            3 aktive rum · 2 runder åbne · Paris–Roubaix om 2 dage
          </div>
        </div>

        {/* Stats strip */}
        <Glass style={{ padding: '20px 32px', marginBottom: 28, display: 'flex', justifyContent: 'space-around' }}>
          <Stat value="342" label="Point" accent={T.accent} />
          <div style={{ width: 1, background: T.border }} />
          <Stat value="62%" label="Hit rate" />
          <div style={{ width: 1, background: T.border }} />
          <Stat value="14" label="Runder" />
          <div style={{ width: 1, background: T.border }} />
          <Stat value="3" label="Aktive rum" />
        </Glass>

        {/* Featured match */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontFamily: F, fontSize: 10, fontWeight: 700, color: T.t3, letterSpacing: '0.12em', marginBottom: 12 }}>
            KAMPDAG
          </div>
          <LiveMatchHero />
        </div>

        {/* Rooms */}
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontFamily: F, fontSize: 10, fontWeight: 700, color: T.t3, letterSpacing: '0.12em', marginBottom: 12 }}>
            DINE RUM
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
          <RoomCard
            name="Bodega Betting"
            sport="Fodbold · Block 3"
            icon={<Trophy size={18} />}
            rank="3. plads"
            badge="LIVE"
            badgeColor={T.accent}
            onClick={() => router.push('/preview/gameroom')}
          />
          <RoomCard
            name="Fantasy Manager"
            sport="Cykling · Ardennerne"
            icon={<Bike size={18} />}
            rank="5. plads"
            badge="SØNDAG"
            badgeColor={T.purple}
            onClick={() => router.push('/preview/gameroom')}
          />
          <RoomCard
            name="Mesterskabet"
            sport="Fodbold · Bodega Rounds"
            icon={<Star size={18} />}
            rank="2. plads"
            badge="UGE 28"
            badgeColor={T.gold}
            onClick={() => router.push('/preview/gameroom')}
          />
        </div>
      </div>
    </div>
  )
}
