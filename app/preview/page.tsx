'use client'

const colors = {
  bg: '#EDE8DF',
  surface: '#F7F4EF',
  surfaceAlt: '#FFFFFF',
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
  goldLight: '#FEF3C7',
}

const font = "'Plus Jakarta Sans', sans-serif"

// ─── TOKENS ────────────────────────────────────────────────
const card: React.CSSProperties = {
  background: colors.surfaceAlt,
  borderRadius: 16,
  border: `1px solid ${colors.border}`,
  boxShadow: '0 2px 12px rgba(27,67,50,0.06)',
}

const pill = (bg: string, color: string): React.CSSProperties => ({
  background: bg,
  color,
  borderRadius: 20,
  padding: '3px 10px',
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '0.06em',
  display: 'inline-block',
})

// ─── FEATURED MATCH ────────────────────────────────────────
function FeaturedMatch() {
  return (
    <div style={{
      background: colors.greenDeep,
      borderRadius: 20,
      padding: '20px 24px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Pitch texture circles */}
      <div style={{
        position: 'absolute', top: -60, left: '50%', transform: 'translateX(-50%)',
        width: 320, height: 320,
        border: '1px solid rgba(116,198,157,0.08)',
        borderRadius: '50%', pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', top: -30, left: '50%', transform: 'translateX(-50%)',
        width: 200, height: 200,
        border: '1px solid rgba(116,198,157,0.06)',
        borderRadius: '50%', pointerEvents: 'none',
      }} />

      {/* Top row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, position: 'relative' }}>
        <div style={pill('#4CAF6020', '#81C784')}>SUPERLIGA</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#4CAF50' }} />
          <span style={{ fontSize: 10, fontWeight: 700, color: '#81C784', letterSpacing: '0.1em' }}>DERBY</span>
        </div>
        <div style={pill('rgba(255,255,255,0.08)', 'rgba(255,255,255,0.5)')}>Søndag 13:00</div>
      </div>

      {/* Teams */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 16, marginBottom: 20, position: 'relative' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(116,198,157,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 8px',
            fontSize: 13, fontWeight: 800, color: '#fff',
          }}>FCK</div>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>FC København</div>
          <div style={{ fontSize: 11, color: colors.muted, marginTop: 2 }}>Hjemme</div>
        </div>

        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em' }}>VS</div>
        </div>

        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(116,198,157,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 8px',
            fontSize: 13, fontWeight: 800, color: '#fff',
          }}>BIF</div>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>Brøndby IF</div>
          <div style={{ fontSize: 11, color: colors.muted, marginTop: 2 }}>Ude</div>
        </div>
      </div>

      {/* Odds */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, position: 'relative' }}>
        {[
          { label: 'FCK vinder', odds: '1.85', active: true },
          { label: 'Uafgjort', odds: '3.40', active: false },
          { label: 'Brøndby vinder', odds: '4.10', active: false },
        ].map((o) => (
          <div key={o.label} style={{
            background: o.active ? colors.greenMid : 'rgba(255,255,255,0.06)',
            border: `1px solid ${o.active ? colors.greenMid : 'rgba(255,255,255,0.08)'}`,
            borderRadius: 12,
            padding: '10px 8px',
            textAlign: 'center',
            cursor: 'pointer',
          }}>
            <div style={{ fontSize: 9, color: o.active ? colors.greenDeep : 'rgba(255,255,255,0.4)', fontWeight: 600, marginBottom: 4 }}>{o.label}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: o.active ? colors.greenDeep : '#fff' }}>{o.odds}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── MATCH CARD ─────────────────────────────────────────────
function MatchCard({ league, home, away, odds, tag }: {
  league: string, home: string, away: string,
  odds: [number, number, number], tag?: { label: string, type: 'derby' | 'open' | 'locked' }
}) {
  const tagStyles = {
    derby: { bg: colors.redLight, color: colors.red },
    open: { bg: colors.greenLight, color: colors.greenDark },
    locked: { bg: colors.warmLight, color: colors.warm },
  }
  const t = tag ? tagStyles[tag.type] : null

  return (
    <div style={{ ...card, padding: '14px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: 10, fontWeight: 600, color: colors.muted, letterSpacing: '0.08em' }}>{league}</span>
        {tag && t && <span style={pill(t.bg, t.color)}>{tag.label}</span>}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: colors.charcoal }}>{home}</span>
        <span style={{ fontSize: 11, color: colors.muted }}>vs</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: colors.charcoal }}>{away}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
        {['1', 'X', '2'].map((label, i) => (
          <div key={label} style={{
            background: colors.bg,
            borderRadius: 8,
            padding: '6px 4px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 9, color: colors.muted, marginBottom: 2 }}>{label}</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: colors.charcoal }}>{odds[i].toFixed(2)}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── LEADERBOARD ────────────────────────────────────────────
function Leaderboard() {
  const players = [
    { rank: 1, name: 'Jonas', pts: 148, delta: +12, av: 'JR', avc: ['#FEF3C7', '#92400E'] },
    { rank: 2, name: 'Peter', pts: 138, delta: 0,   av: 'PL', avc: ['#EFF6FF', '#1E40AF'] },
    { rank: 3, name: 'Mikkel', pts: 124, delta: +8, av: 'MK', avc: [colors.greenLight, colors.greenDeep], me: true },
    { rank: 4, name: 'Simon', pts: 117, delta: -3,  av: 'SK', avc: ['#FDF2F8', '#9D174D'] },
    { rank: 5, name: 'Anders', pts: 109, delta: -1, av: 'AN', avc: ['#F5F3FF', '#5B21B6'] },
  ]

  return (
    <div style={{ ...card, padding: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: colors.charcoal }}>Leaderboard</span>
        <span style={pill(colors.greenLight, colors.greenDark)}>Block 3</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {players.map((p) => (
          <div key={p.name} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '8px 10px',
            borderRadius: 10,
            background: ('me' in p && p.me) ? colors.greenLight : 'transparent',
          }}>
            <span style={{
              fontSize: 12, fontWeight: 800,
              color: p.rank === 1 ? colors.gold : p.rank === 2 ? '#94A3B8' : colors.muted,
              width: 18, textAlign: 'center', flexShrink: 0,
            }}>{p.rank}</span>
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              background: p.avc[0], color: p.avc[1],
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 9, fontWeight: 800, flexShrink: 0,
            }}>{p.av}</div>
            <span style={{ flex: 1, fontSize: 13, fontWeight: ('me' in p && p.me) ? 700 : 500, color: colors.charcoal }}>{p.name}{('me' in p && p.me) ? ' ◂' : ''}</span>
            <span style={{ fontSize: 14, fontWeight: 800, color: colors.charcoal }}>{p.pts}</span>
            <span style={{
              fontSize: 10, fontWeight: 700, width: 28, textAlign: 'right',
              color: p.delta > 0 ? colors.greenDark : p.delta < 0 ? colors.red : colors.muted,
            }}>{p.delta > 0 ? `+${p.delta}` : p.delta === 0 ? '—' : p.delta}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── MY STATS ───────────────────────────────────────────────
function MyStats() {
  return (
    <div style={{
      background: colors.greenDeep,
      borderRadius: 16,
      padding: '16px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 11, color: colors.greenMid, fontWeight: 600, marginBottom: 2 }}>Velkommen tilbage</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>Mikkel</div>
        </div>
        <div style={pill(colors.greenMid, colors.greenDeep)}>3. plads</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        {[
          { num: '124', label: 'Point' },
          { num: '+8', label: 'Denne uge' },
          { num: '62%', label: 'Hit rate' },
        ].map((s) => (
          <div key={s.label} style={{
            background: 'rgba(255,255,255,0.08)',
            borderRadius: 10,
            padding: '10px 8px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#fff' }}>{s.num}</div>
            <div style={{ fontSize: 9, color: colors.greenMid, marginTop: 2, fontWeight: 500 }}>{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── CYCLING CARD ───────────────────────────────────────────
function CyclingCard() {
  return (
    <div style={{
      ...card,
      padding: '14px 16px',
      borderLeft: `3px solid ${colors.greenMid}`,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, color: colors.muted, letterSpacing: '0.1em', marginBottom: 3 }}>CYKLING · SØNDAG</div>
          <div style={{ fontSize: 15, fontWeight: 800, color: colors.charcoal }}>Paris–Roubaix</div>
        </div>
        <span style={pill(colors.warmLight, colors.warm)}>Lock 10:00</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
        {[
          { num: '25', label: 'Ryttere' },
          { num: '8', label: 'Aktiv' },
          { num: '2d', label: 'Til start' },
        ].map((s) => (
          <div key={s.label} style={{
            background: colors.bg,
            borderRadius: 8,
            padding: '8px 6px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: colors.greenDark }}>{s.num}</div>
            <div style={{ fontSize: 9, color: colors.muted, marginTop: 1 }}>{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── PAGE ───────────────────────────────────────────────────
export default function PreviewPage() {
  return (
    <div style={{ fontFamily: font, background: colors.bg, minHeight: '100vh' }}>

      {/* Topbar */}
      <div style={{
        background: colors.surface,
        borderBottom: `1px solid ${colors.border}`,
        display: 'flex', alignItems: 'center',
        padding: '0 24px', height: 56, gap: 16,
      }}>
        <div style={{
          background: colors.greenDeep, borderRadius: 10,
          width: 34, height: 34,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, fontWeight: 800, color: colors.greenLight,
          letterSpacing: '-0.3px', flexShrink: 0,
        }}>BB</div>
        <span style={{ fontSize: 17, fontWeight: 800, color: colors.charcoal, flex: 1 }}>
          Bodega<span style={{ color: colors.greenMid }}>.</span>Bets
        </span>
        <span style={pill(colors.greenLight, colors.greenDark)}>Block 3 · Uge 28</span>
        <span style={{ fontSize: 11, color: colors.muted }}>Fre 11. apr</span>
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          background: colors.greenLight, color: colors.greenDeep,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 800,
        }}>MK</div>
      </div>

      {/* Layout */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '56px 1fr 280px',
        minHeight: 'calc(100vh - 56px)',
      }}>

        {/* Sidebar */}
        <div style={{
          background: colors.surface,
          borderRight: `1px solid ${colors.border}`,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', padding: '16px 0', gap: 6,
        }}>
          {[
            { icon: '⊞', active: true },
            { icon: '◷', active: false },
            { icon: '↗', active: false },
            { icon: '◉', active: false },
          ].map((n, i) => (
            <div key={i} style={{
              width: 38, height: 38, borderRadius: 10,
              background: n.active ? colors.greenLight : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, cursor: 'pointer',
              color: n.active ? colors.greenDark : colors.muted,
            }}>{n.icon}</div>
          ))}
        </div>

        {/* Main */}
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: colors.muted, letterSpacing: '0.12em', marginBottom: 10 }}>FEATURED MATCH</div>
            <FeaturedMatch />
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: colors.muted, letterSpacing: '0.12em', marginBottom: 10 }}>ØVRIGE KAMPE</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <MatchCard league="PREMIER LEAGUE" home="Man City" away="Arsenal" odds={[1.60, 3.80, 5.50]} tag={{ label: 'Låst', type: 'locked' }} />
              <MatchCard league="LA LIGA" home="Real Madrid" away="Barça" odds={[2.10, 3.30, 3.60]} tag={{ label: 'Derby', type: 'derby' }} />
              <MatchCard league="BUNDESLIGA" home="Bayern" away="BVB" odds={[1.70, 3.60, 5.00]} tag={{ label: 'Åben', type: 'open' }} />
              <MatchCard league="LIGUE 1" home="PSG" away="Marseille" odds={[1.45, 4.20, 7.00]} tag={{ label: 'Derby', type: 'derby' }} />
            </div>
          </div>
        </div>

        {/* Right panel */}
        <div style={{
          background: colors.surface,
          borderLeft: `1px solid ${colors.border}`,
          padding: 20, display: 'flex', flexDirection: 'column', gap: 16,
        }}>
          <MyStats />
          <Leaderboard />
          <CyclingCard />
        </div>

      </div>
    </div>
  )
}
