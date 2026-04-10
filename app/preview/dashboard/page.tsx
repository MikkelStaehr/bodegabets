'use client'

import { useRouter } from 'next/navigation'
import { Home, Trophy, Bike, TrendingUp, Users, Clock, Zap, ChevronRight, AlertTriangle } from 'lucide-react'

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

function StatCard({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div style={{
      background: C.surface, borderRadius: 14, padding: '16px 14px',
      border: `1px solid ${C.border}`,
      display: 'flex', alignItems: 'center', gap: 12,
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: 10,
        background: C.greenLight,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: C.greenDark,
      }}>
        {icon}
      </div>
      <div>
        <div style={{ fontFamily: FONT, fontSize: 20, fontWeight: 800, color: C.charcoal, lineHeight: 1 }}>{value}</div>
        <div style={{ fontFamily: FONT, fontSize: 10, color: C.muted, marginTop: 2 }}>{label}</div>
      </div>
    </div>
  )
}

function RoomCard({ name, sport, badge, rank, rankColor, progress, progressColor, warning, disabled, onClick }: {
  name: string; sport: string; badge: { label: string; bg: string; color: string; icon?: React.ReactNode }
  rank: string; rankColor: string; progress: number; progressColor: string
  warning?: string; disabled?: boolean; onClick?: () => void
}) {
  return (
    <div
      onClick={disabled ? undefined : onClick}
      style={{
        borderRadius: 16, overflow: 'hidden',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.55 : 1,
        border: `1px solid ${C.border}`,
        boxShadow: '0 2px 16px rgba(27,67,50,0.06)',
        transition: 'transform 0.15s, box-shadow 0.15s',
      }}
      onMouseEnter={(e) => { if (!disabled) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 24px rgba(27,67,50,0.1)' } }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 2px 16px rgba(27,67,50,0.06)' }}
    >
      {/* Header */}
      <div style={{
        height: 110, background: `linear-gradient(135deg, ${C.greenDeep} 0%, #244E3D 100%)`,
        position: 'relative', padding: '16px 18px',
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {sport === 'football' ? <Trophy size={12} color={C.greenMid} /> : <Bike size={12} color={C.greenMid} />}
            <span style={{ fontFamily: FONT, fontSize: 9, fontWeight: 700, color: C.greenMid, letterSpacing: '0.1em' }}>
              {sport === 'football' ? 'FODBOLD' : 'CYKLING'}
            </span>
          </div>
          <span style={{
            background: badge.bg, color: badge.color,
            borderRadius: 20, padding: '3px 10px',
            fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
            {badge.icon}{badge.label}
          </span>
        </div>
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ fontFamily: FONT, fontSize: 18, fontWeight: 800, color: '#fff' }}>{name}</div>
        </div>
        {/* Decorative */}
        <div style={{
          position: 'absolute', top: -30, right: -30,
          width: 120, height: 120, borderRadius: '50%',
          border: '1px solid rgba(116,198,157,0.08)',
        }} />
      </div>

      {/* Body */}
      <div style={{ background: C.surface, padding: '14px 18px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Users size={12} color={C.muted} />
            <span style={{ fontFamily: FONT, fontSize: 11, color: C.muted }}>6 spillere</span>
          </div>
          <span style={{ fontFamily: FONT, fontSize: 12, fontWeight: 700, color: rankColor }}>{rank}</span>
        </div>

        {/* Progress */}
        <div style={{ height: 4, borderRadius: 4, background: `${C.border}`, marginBottom: 12 }}>
          <div style={{
            height: '100%', borderRadius: 4, background: progressColor,
            width: `${progress}%`, transition: 'width 0.5s ease',
          }} />
        </div>

        {warning && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 5,
            fontFamily: FONT, fontSize: 10, color: C.red, fontWeight: 600, marginBottom: 8,
            padding: '5px 8px', borderRadius: 6, background: C.redLight,
          }}>
            <AlertTriangle size={11} />
            {warning}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex' }}>
            {['JR', 'PL', 'MK'].map((a, i) => (
              <div key={a} style={{
                width: 24, height: 24, borderRadius: '50%',
                background: C.greenLight, border: `2px solid ${C.surface}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 7, fontWeight: 800, color: C.greenDeep,
                marginLeft: i > 0 ? -6 : 0, position: 'relative', zIndex: 3 - i,
              }}>{a}</div>
            ))}
          </div>
          {!disabled && (
            <span style={{
              fontFamily: FONT, fontSize: 11, fontWeight: 700, color: C.greenDark,
              display: 'flex', alignItems: 'center', gap: 2,
            }}>
              Åben <ChevronRight size={14} />
            </span>
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
      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '32px 24px' }}>
        {/* Greeting */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 26, fontWeight: 800, color: C.charcoal, lineHeight: 1.2 }}>
            God morgen, <span style={{ color: C.greenMid }}>Mikkel</span>.
          </div>
          <div style={{ fontSize: 13, color: C.muted, marginTop: 6 }}>
            Du spiller i 3 rum · 2 runder åbne · Paris–Roubaix om 2 dage
          </div>
        </div>

        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, marginBottom: 28 }}>
          <StatCard icon={<Zap size={18} />} value="342" label="Total point" />
          <StatCard icon={<TrendingUp size={18} />} value="62%" label="Hit rate" />
          <StatCard icon={<Clock size={18} />} value="14" label="Runder spillet" />
          <StatCard icon={<Home size={18} />} value="3" label="Aktive rum" />
        </div>

        {/* Room cards */}
        <div style={{ marginBottom: 8 }}>
          <span style={{ fontFamily: FONT, fontSize: 10, fontWeight: 700, color: C.muted, letterSpacing: '0.12em' }}>
            DINE RUM
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
          <RoomCard
            name="Bodega Betting"
            sport="football"
            badge={{ label: 'LIVE', bg: C.greenLight, color: C.greenDark, icon: <Zap size={10} /> }}
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
      </div>
    </div>
  )
}
