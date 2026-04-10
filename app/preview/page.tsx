'use client'

// ── Design tokens ──────────────────────────────────────────────────────────

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

// ── SVG Icons ──────────────────────────────────────────────────────────────

function IconHome({ active }: { active?: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M3 10L10 3L17 10V17H12V13H8V17H3V10Z" stroke={active ? colors.greenDark : colors.muted} strokeWidth="1.5" fill={active ? colors.greenDark : 'none'} />
    </svg>
  )
}

function IconTrophy() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M6 3H14V8C14 10.2 12.2 12 10 12C7.8 12 6 10.2 6 8V3Z" stroke={colors.muted} strokeWidth="1.5" />
      <path d="M8 15H12M10 12V15" stroke={colors.muted} strokeWidth="1.5" />
    </svg>
  )
}

function IconCycling() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <circle cx="5" cy="14" r="3" stroke={colors.muted} strokeWidth="1.5" />
      <circle cx="15" cy="14" r="3" stroke={colors.muted} strokeWidth="1.5" />
      <path d="M5 14L8 6H12L15 14M8 6L10 14" stroke={colors.muted} strokeWidth="1.5" />
    </svg>
  )
}

function IconSettings() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="3" stroke={colors.muted} strokeWidth="1.5" />
      <path d="M10 2V4M10 16V18M2 10H4M16 10H18M4.2 4.2L5.6 5.6M14.4 14.4L15.8 15.8M15.8 4.2L14.4 5.6M5.6 14.4L4.2 15.8" stroke={colors.muted} strokeWidth="1.5" />
    </svg>
  )
}

// ── Components ─────────────────────────────────────────────────────────────

function Topbar() {
  return (
    <div style={{
      height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 20px', background: colors.surfaceAlt,
      borderBottom: `1px solid ${colors.border}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {/* Logo mark */}
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: colors.greenDeep, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontFamily: font, fontWeight: 800, fontSize: 14,
        }}>
          BB
        </div>
        <span style={{ fontFamily: font, fontWeight: 700, fontSize: 16, color: colors.charcoal }}>
          Bodega<span style={{ color: colors.greenDark }}>.Bets</span>
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{
          fontFamily: font, fontSize: 11, fontWeight: 600,
          padding: '4px 10px', borderRadius: 6,
          background: colors.greenLight, color: colors.greenDark,
        }}>
          Block 3
        </span>
        <span style={{ fontFamily: font, fontSize: 13, color: colors.muted }}>
          10. apr 2026
        </span>
        <div style={{
          width: 32, height: 32, borderRadius: 999,
          background: colors.greenMid, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontFamily: font, fontWeight: 700, fontSize: 12,
        }}>
          MS
        </div>
      </div>
    </div>
  )
}

function Sidebar() {
  const icons = [
    { icon: <IconHome active />, active: true },
    { icon: <IconTrophy /> },
    { icon: <IconCycling /> },
    { icon: <IconSettings /> },
  ]

  return (
    <div style={{
      width: 56, background: colors.surfaceAlt,
      borderRight: `1px solid ${colors.border}`,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', paddingTop: 16, gap: 4,
    }}>
      {icons.map((item, i) => (
        <div
          key={i}
          style={{
            width: 40, height: 40, borderRadius: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: item.active ? colors.greenLight : 'transparent',
            cursor: 'pointer',
          }}
        >
          {item.icon}
        </div>
      ))}
    </div>
  )
}

function FeaturedMatch() {
  return (
    <div style={{
      background: colors.greenDeep, borderRadius: 16,
      padding: 24, position: 'relative', overflow: 'hidden',
      color: '#fff',
    }}>
      {/* Decorative circles */}
      <div style={{
        position: 'absolute', top: -40, right: -40,
        width: 200, height: 200, borderRadius: '50%',
        border: `1px solid rgba(255,255,255,0.06)`,
      }} />
      <div style={{
        position: 'absolute', top: -20, right: -20,
        width: 160, height: 160, borderRadius: '50%',
        border: `1px solid rgba(255,255,255,0.04)`,
      }} />

      {/* Top row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, position: 'relative', zIndex: 1 }}>
        <span style={{
          fontFamily: font, fontSize: 11, fontWeight: 600,
          padding: '3px 8px', borderRadius: 6,
          background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)',
        }}>
          Champions League
        </span>
        <span style={{
          fontFamily: font, fontSize: 10, fontWeight: 700,
          padding: '3px 8px', borderRadius: 6,
          background: colors.red, color: '#fff',
        }}>
          DERBY
        </span>
        <span style={{
          fontFamily: font, fontSize: 11, fontWeight: 600,
          padding: '3px 8px', borderRadius: 6,
          background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)',
          marginLeft: 'auto',
        }}>
          21:00
        </span>
      </div>

      {/* Teams */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr auto 1fr',
        alignItems: 'center', gap: 20, marginBottom: 24,
        position: 'relative', zIndex: 1,
      }}>
        {/* Home */}
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            background: 'rgba(255,255,255,0.1)',
            margin: '0 auto 8px', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            fontFamily: font, fontWeight: 700, fontSize: 18, color: 'rgba(255,255,255,0.5)',
          }}>
            FCB
          </div>
          <div style={{ fontFamily: font, fontWeight: 700, fontSize: 15 }}>FC Barcelona</div>
          <div style={{ fontFamily: font, fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>Hjemme</div>
        </div>

        {/* VS */}
        <div style={{
          fontFamily: font, fontWeight: 800, fontSize: 14,
          color: 'rgba(255,255,255,0.3)',
        }}>
          VS
        </div>

        {/* Away */}
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            background: 'rgba(255,255,255,0.1)',
            margin: '0 auto 8px', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            fontFamily: font, fontWeight: 700, fontSize: 18, color: 'rgba(255,255,255,0.5)',
          }}>
            RMA
          </div>
          <div style={{ fontFamily: font, fontWeight: 700, fontSize: 15 }}>Real Madrid</div>
          <div style={{ fontFamily: font, fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>Ude</div>
        </div>
      </div>

      {/* Odds row */}
      <div style={{ display: 'flex', gap: 8, position: 'relative', zIndex: 1 }}>
        {[
          { label: '1', odds: '2.10', selected: true },
          { label: 'X', odds: '3.40', selected: false },
          { label: '2', odds: '2.85', selected: false },
        ].map((o) => (
          <button
            key={o.label}
            style={{
              flex: 1, padding: '10px 0', borderRadius: 10, border: 'none',
              background: o.selected ? colors.greenMid : 'rgba(255,255,255,0.08)',
              color: o.selected ? colors.greenDeep : 'rgba(255,255,255,0.6)',
              fontFamily: font, fontWeight: 700, fontSize: 13, cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
            }}
          >
            <span style={{ fontSize: 11, fontWeight: 600, opacity: 0.7 }}>{o.label}</span>
            <span>{o.odds}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function MatchCard({ home, away, league, tag, odds }: {
  home: string; away: string; league: string; tag?: string
  odds: [string, string, string]
}) {
  return (
    <div style={{
      background: colors.surfaceAlt, borderRadius: 16,
      padding: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
        <span style={{ fontFamily: font, fontSize: 11, fontWeight: 600, color: colors.muted }}>{league}</span>
        {tag && (
          <span style={{
            fontFamily: font, fontSize: 10, fontWeight: 600,
            padding: '2px 6px', borderRadius: 4,
            background: colors.goldLight, color: colors.gold,
          }}>
            {tag}
          </span>
        )}
      </div>
      <div style={{ fontFamily: font, fontSize: 14, fontWeight: 600, color: colors.charcoal, marginBottom: 4 }}>
        {home}
      </div>
      <div style={{ fontFamily: font, fontSize: 14, fontWeight: 600, color: colors.charcoal, marginBottom: 14 }}>
        {away}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        {['1', 'X', '2'].map((label, i) => (
          <div
            key={label}
            style={{
              flex: 1, textAlign: 'center', padding: '8px 0',
              borderRadius: 8, background: colors.bg,
              fontFamily: font, fontSize: 13, fontWeight: 700, color: colors.charcoal,
            }}
          >
            <span style={{ fontSize: 10, fontWeight: 600, color: colors.muted, display: 'block', marginBottom: 2 }}>{label}</span>
            {odds[i]}
          </div>
        ))}
      </div>
    </div>
  )
}

function MyStats() {
  return (
    <div style={{
      background: colors.greenDeep, borderRadius: 16,
      padding: 20, color: '#fff',
    }}>
      <div style={{ fontFamily: font, fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 2 }}>Velkommen tilbage</div>
      <div style={{ fontFamily: font, fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Mikkel</div>
      <div style={{ display: 'flex', gap: 8 }}>
        {[
          { value: '124', label: 'Point' },
          { value: '+8', label: 'Uge' },
          { value: '62%', label: 'Hit rate' },
        ].map((s) => (
          <div
            key={s.label}
            style={{
              flex: 1, textAlign: 'center', padding: '10px 0',
              borderRadius: 10, background: 'rgba(255,255,255,0.08)',
            }}
          >
            <div style={{ fontFamily: font, fontSize: 18, fontWeight: 800 }}>{s.value}</div>
            <div style={{ fontFamily: font, fontSize: 10, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Leaderboard() {
  const players = [
    { rank: 1, name: 'Jonas', pts: 148, diff: '+12', highlight: false },
    { rank: 2, name: 'Peter', pts: 138, diff: '—', highlight: false },
    { rank: 3, name: 'Mikkel', pts: 124, diff: '+8', highlight: true },
    { rank: 4, name: 'Simon', pts: 117, diff: '-3', highlight: false },
    { rank: 5, name: 'Anders', pts: 109, diff: '-1', highlight: false },
  ]

  const rankColor = (rank: number) => {
    if (rank === 1) return colors.gold
    if (rank === 2) return '#94A3B8'
    return colors.muted
  }

  return (
    <div style={{
      background: colors.surfaceAlt, borderRadius: 16,
      padding: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    }}>
      <div style={{ fontFamily: font, fontSize: 13, fontWeight: 700, color: colors.charcoal, marginBottom: 12 }}>
        Leaderboard
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {players.map((p) => (
          <div
            key={p.rank}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 10px', borderRadius: 10,
              background: p.highlight ? colors.greenLight : 'transparent',
            }}
          >
            <span style={{
              fontFamily: font, fontSize: 14, fontWeight: 800,
              color: rankColor(p.rank), width: 20, textAlign: 'center',
            }}>
              {p.rank}
            </span>
            <span style={{ fontFamily: font, fontSize: 13, fontWeight: 600, color: colors.charcoal, flex: 1 }}>
              {p.name}
            </span>
            <span style={{ fontFamily: font, fontSize: 13, fontWeight: 700, color: colors.charcoal }}>
              {p.pts}
            </span>
            <span style={{
              fontFamily: font, fontSize: 11, fontWeight: 600, width: 32, textAlign: 'right',
              color: p.diff.startsWith('+') ? colors.greenDark : p.diff.startsWith('-') ? colors.red : colors.muted,
            }}>
              {p.diff}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function CyclingCard() {
  return (
    <div style={{
      background: colors.surfaceAlt, borderRadius: 16,
      padding: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      borderLeft: `4px solid ${colors.greenMid}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ fontFamily: font, fontSize: 13, fontWeight: 700, color: colors.charcoal }}>
          Paris–Roubaix
        </div>
        <span style={{
          fontFamily: font, fontSize: 10, fontWeight: 600,
          padding: '3px 8px', borderRadius: 6,
          background: colors.redLight, color: colors.red,
        }}>
          Låser 12. apr 11:30
        </span>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        {[
          { value: '258 km', label: 'Distance' },
          { value: 'Brosten', label: 'Profil' },
          { value: '6/8', label: 'Lineup' },
        ].map((s) => (
          <div
            key={s.label}
            style={{
              flex: 1, textAlign: 'center', padding: '8px 0',
              borderRadius: 8, background: colors.bg,
            }}
          >
            <div style={{ fontFamily: font, fontSize: 13, fontWeight: 700, color: colors.charcoal }}>{s.value}</div>
            <div style={{ fontFamily: font, fontSize: 10, color: colors.muted, marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function PreviewPage() {
  return (
    <div style={{ fontFamily: font, minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Topbar />

      <div style={{ display: 'flex', flex: 1 }}>
        <Sidebar />

        {/* Main content */}
        <div style={{ flex: 1, padding: 24, overflow: 'auto' }}>
          <div style={{ maxWidth: 800 }}>
            {/* Featured */}
            <div style={{ marginBottom: 20 }}>
              <div style={{
                fontFamily: font, fontSize: 11, fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: '0.08em',
                color: colors.muted, marginBottom: 10,
              }}>
                Featured Match
              </div>
              <FeaturedMatch />
            </div>

            {/* Other matches */}
            <div>
              <div style={{
                fontFamily: font, fontSize: 11, fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: '0.08em',
                color: colors.muted, marginBottom: 10,
              }}>
                Øvrige Kampe
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <MatchCard home="Liverpool" away="Arsenal" league="Premier League" tag="Top 4" odds={['2.40', '3.20', '2.90']} />
                <MatchCard home="Inter" away="AC Milan" league="Serie A" tag="Derby" odds={['1.95', '3.50', '3.80']} />
                <MatchCard home="Bayern" away="Dortmund" league="Bundesliga" odds={['1.65', '4.00', '4.50']} />
                <MatchCard home="PSG" away="Marseille" league="Ligue 1" tag="Rivali" odds={['1.50', '4.20', '5.50']} />
              </div>
            </div>
          </div>
        </div>

        {/* Right panel */}
        <div style={{
          width: 280, background: colors.surface,
          borderLeft: `1px solid ${colors.border}`,
          padding: 20, overflow: 'auto',
          display: 'flex', flexDirection: 'column', gap: 16,
        }}>
          <MyStats />
          <Leaderboard />
          <CyclingCard />
        </div>
      </div>
    </div>
  )
}
