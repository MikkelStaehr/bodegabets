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

function Topbar() {
  return (
    <div style={{
      height: 52, background: C.surface,
      borderBottom: `1px solid ${C.border}`,
      display: 'flex', alignItems: 'center',
      padding: '0 24px', gap: 12,
    }}>
      <div style={{
        width: 30, height: 30, borderRadius: 8,
        background: C.greenDeep,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11, fontWeight: 800, color: C.greenLight,
      }}>BB</div>
      <span style={{ fontFamily: FONT, fontSize: 16, fontWeight: 800, color: C.charcoal, flex: 1 }}>
        Bodega<span style={{ color: C.greenMid }}>.</span>Bets
      </span>
      <div style={{
        width: 32, height: 32, borderRadius: '50%',
        background: C.greenLight, color: C.greenDeep,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11, fontWeight: 800,
      }}>MK</div>
    </div>
  )
}

function FootballSVG() {
  return (
    <svg width="100%" height="100%" viewBox="0 0 300 100" style={{ position: 'absolute', inset: 0, opacity: 0.06 }}>
      <line x1="150" y1="0" x2="150" y2="100" stroke="#fff" strokeWidth="1" />
      <circle cx="150" cy="50" r="30" stroke="#fff" strokeWidth="1" fill="none" />
    </svg>
  )
}

function CyclingSVG() {
  return (
    <svg width="100%" height="100%" viewBox="0 0 300 100" style={{ position: 'absolute', inset: 0, opacity: 0.06 }}>
      <line x1="0" y1="80" x2="300" y2="20" stroke="#fff" strokeWidth="1" />
      <line x1="0" y1="90" x2="300" y2="30" stroke="#fff" strokeWidth="1" />
      <line x1="0" y1="100" x2="300" y2="40" stroke="#fff" strokeWidth="1" />
    </svg>
  )
}

function RoomCard({ name, sport, badge, rank, rankColor, progress, progressColor, warning, disabled, onClick }: {
  name: string; sport: string; badge: { label: string; bg: string; color: string }
  rank: string; rankColor: string; progress: number; progressColor: string
  warning?: string; disabled?: boolean; onClick?: () => void
}) {
  return (
    <div
      onClick={onClick}
      style={{
        borderRadius: 14, overflow: 'hidden', cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.55 : 1, border: `1px solid ${C.border}`,
        boxShadow: '0 2px 12px rgba(27,67,50,0.06)',
      }}
    >
      <div style={{
        height: 100, background: C.greenDeep,
        position: 'relative', padding: '14px 16px',
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
      }}>
        {sport === 'football' ? <FootballSVG /> : <CyclingSVG />}
        <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative' }}>
          <span style={{ fontFamily: FONT, fontSize: 9, fontWeight: 700, color: C.greenMid, letterSpacing: '0.1em' }}>
            {sport === 'football' ? 'FODBOLD' : 'CYKLING'}
          </span>
          {pill(badge.label, badge.bg, badge.color)}
        </div>
        <div style={{ position: 'relative' }}>
          <div style={{ fontFamily: FONT, fontSize: 16, fontWeight: 800, color: '#fff' }}>{name}</div>
        </div>
      </div>
      <div style={{ background: C.surface, padding: '14px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontFamily: FONT, fontSize: 11, color: C.muted }}>6 spillere</span>
          <span style={{ fontFamily: FONT, fontSize: 12, fontWeight: 700, color: rankColor }}>{rank}</span>
        </div>
        <div style={{ height: 3, borderRadius: 3, background: C.border, marginBottom: 10 }}>
          <div style={{ height: '100%', borderRadius: 3, background: progressColor, width: `${progress}%` }} />
        </div>
        {warning && (
          <div style={{ fontFamily: FONT, fontSize: 10, color: C.red, fontWeight: 600, marginBottom: 6 }}>{warning}</div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: -4 }}>
            {['JR', 'PL', 'MK'].map((a, i) => (
              <div key={a} style={{
                width: 22, height: 22, borderRadius: '50%',
                background: C.greenLight, border: `2px solid ${C.surface}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 7, fontWeight: 800, color: C.greenDeep,
                marginLeft: i > 0 ? -6 : 0, position: 'relative', zIndex: 3 - i,
              }}>{a}</div>
            ))}
          </div>
          {!disabled && (
            <span style={{ fontFamily: FONT, fontSize: 11, fontWeight: 700, color: C.greenDark }}>Åben →</span>
          )}
        </div>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const router = useRouter()

  return (
    <div style={{ fontFamily: FONT, background: C.bg, minHeight: '100vh' }}>
      <Topbar />
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '32px 24px' }}>
        {/* Greeting */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: C.charcoal }}>
            God morgen, <span style={{ color: C.greenMid }}>Mikkel</span>.
          </div>
          <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>
            Du spiller i 3 rum · 2 runder åbne · Paris–Roubaix om 2 dage
          </div>
        </div>

        {/* Room cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 28 }}>
          <RoomCard
            name="Bodega Betting"
            sport="football"
            badge={{ label: 'LIVE', bg: C.greenLight, color: C.greenDark }}
            rank="3. plads"
            rankColor={C.greenDark}
            progress={60}
            progressColor={C.greenMid}
            onClick={() => router.push('/preview/gameroom')}
          />
          <RoomCard
            name="Fantasy Manager"
            sport="cycling"
            badge={{ label: 'Søndag', bg: C.warmLight, color: C.warm }}
            rank="5. plads"
            rankColor={C.warm}
            progress={85}
            progressColor={C.greenMid}
            warning="Opstilling mangler"
          />
          <RoomCard
            name="Mesterskabet"
            sport="football"
            badge={{ label: 'Afsluttet', bg: C.border, color: C.muted }}
            rank="2. plads"
            rankColor={C.muted}
            progress={100}
            progressColor={C.muted}
            disabled
          />
        </div>

        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }}>
          {[
            { value: '342', label: 'Total point' },
            { value: '62%', label: 'Hit rate' },
            { value: '14', label: 'Runder' },
            { value: '3', label: 'Aktive rum' },
          ].map((s) => (
            <div key={s.label} style={{
              background: C.surface, borderRadius: 12, padding: 14,
              textAlign: 'center', border: `1px solid ${C.border}`,
            }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: C.charcoal }}>{s.value}</div>
              <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
