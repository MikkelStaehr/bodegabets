'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trophy, Bike, ChevronRight, Users, Clock, TrendingUp, CalendarDays, Star, Bell } from 'lucide-react'

// ─── Soft earth palette ─────────────────────────────────────

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
  warm: '#B8A88A',
  warmLight: '#F0EBE1',
  ink: '#2D2A26',
  t2: '#6B665E',
  t3: '#9E9890',
  border: '#E5E0D8',
  borderLight: '#EDEBE6',
}
const F = "'Plus Jakarta Sans', sans-serif"

// ─── Components ─────────────────────────────────────────────

function Topbar() {
  return (
    <div style={{
      height: 60, display: 'flex', alignItems: 'center',
      padding: '0 32px', gap: 16,
      background: T.cream,
      borderBottom: `1px solid ${T.border}`,
    }}>
      <div style={{
        width: 34, height: 34, borderRadius: 10,
        background: T.sageDeep,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 13, fontWeight: 900, color: T.oliveLight,
        letterSpacing: '-0.5px',
      }}>B</div>
      <span style={{ fontFamily: F, fontSize: 17, fontWeight: 800, color: T.ink, flex: 1 }}>
        bodega<span style={{ color: T.sage }}>.</span>bets
      </span>
      <div style={{
        position: 'relative', width: 34, height: 34, borderRadius: '50%',
        background: T.sand, display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', marginRight: 8,
      }}>
        <Bell size={16} color={T.t2} />
        <div style={{
          position: 'absolute', top: -1, right: -1,
          width: 8, height: 8, borderRadius: '50%',
          background: T.terracotta, border: `2px solid ${T.cream}`,
        }} />
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

function TimelineItem({ time, text, accent }: { time: string; text: string; accent: string }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      <div style={{ width: 6, height: 6, borderRadius: '50%', background: accent, marginTop: 5, flexShrink: 0 }} />
      <div>
        <span style={{ fontFamily: F, fontSize: 10, fontWeight: 700, color: T.t3, letterSpacing: '0.06em' }}>{time}</span>
        <div style={{ fontFamily: F, fontSize: 12, color: T.ink, marginTop: 1 }}>{text}</div>
      </div>
    </div>
  )
}

function RoomCard({ name, sport, icon, iconBg, accentColor, rank, players, nextEvent, onClick }: {
  name: string; sport: string; icon: React.ReactNode; iconBg: string; accentColor: string
  rank: string; players: number; nextEvent: string; onClick?: () => void
}) {
  const [h, setH] = useState(false)
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        background: T.white, borderRadius: 20,
        border: `1px solid ${T.border}`,
        cursor: 'pointer', overflow: 'hidden',
        transform: h ? 'translateY(-3px)' : 'none',
        boxShadow: h ? '0 8px 30px rgba(0,0,0,0.06)' : '0 1px 3px rgba(0,0,0,0.02)',
        transition: 'all 0.25s ease',
      }}
    >
      {/* Accent strip */}
      <div style={{ height: 4, background: `linear-gradient(90deg, ${accentColor}, ${accentColor}88)` }} />

      <div style={{ padding: '22px 22px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 14,
            background: iconBg,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: accentColor,
          }}>{icon}</div>
          <span style={{
            fontFamily: F, fontSize: 11, fontWeight: 700, color: accentColor,
          }}>{rank}</span>
        </div>

        <div style={{ fontFamily: F, fontSize: 17, fontWeight: 800, color: T.ink, marginBottom: 4 }}>{name}</div>
        <div style={{ fontFamily: F, fontSize: 11, color: T.t3, marginBottom: 16 }}>{sport}</div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Users size={12} color={T.t3} />
              <span style={{ fontFamily: F, fontSize: 11, color: T.t3 }}>{players}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Clock size={12} color={T.t3} />
              <span style={{ fontFamily: F, fontSize: 11, color: T.t3 }}>{nextEvent}</span>
            </div>
          </div>
          <ChevronRight size={16} color={T.t3} />
        </div>
      </div>
    </div>
  )
}

// ─── Page ───────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter()

  return (
    <div style={{ fontFamily: F, background: T.bg, minHeight: '100vh' }}>
      <Topbar />

      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '36px 32px' }}>
        {/* Two-column: main + sidebar */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 28 }}>

          {/* Left column */}
          <div>
            {/* Greeting */}
            <div style={{ marginBottom: 32 }}>
              <div style={{ fontFamily: F, fontSize: 28, fontWeight: 800, color: T.ink, lineHeight: 1.2 }}>
                God morgen, Mikkel
              </div>
              <div style={{ fontFamily: F, fontSize: 13, color: T.t3, marginTop: 6 }}>
                Torsdag 10. april · 3 aktive rum
              </div>
            </div>

            {/* Quick stats */}
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12,
              marginBottom: 32,
            }}>
              {[
                { value: '342', label: 'Point i alt', icon: <Star size={15} />, color: T.olive },
                { value: '62%', label: 'Hit rate', icon: <TrendingUp size={15} />, color: T.sage },
                { value: '14', label: 'Runder', icon: <CalendarDays size={15} />, color: T.sky },
                { value: '3', label: 'Aktive rum', icon: <Trophy size={15} />, color: T.warm },
              ].map((s) => (
                <div key={s.label} style={{
                  background: T.white, borderRadius: 16, padding: '18px 16px',
                  border: `1px solid ${T.border}`,
                  display: 'flex', alignItems: 'center', gap: 14,
                }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: 12,
                    background: `${s.color}14`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: s.color,
                  }}>{s.icon}</div>
                  <div>
                    <div style={{ fontFamily: F, fontSize: 20, fontWeight: 800, color: T.ink, lineHeight: 1 }}>{s.value}</div>
                    <div style={{ fontFamily: F, fontSize: 9, color: T.t3, marginTop: 3, letterSpacing: '0.04em' }}>{s.label}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Rooms */}
            <div style={{ fontFamily: F, fontSize: 10, fontWeight: 700, color: T.t3, letterSpacing: '0.12em', marginBottom: 14 }}>
              DINE SPILRUM
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <RoomCard
                name="Bodega Betting"
                sport="Fodbold · Block 3 · Uge 28"
                icon={<Trophy size={20} />}
                iconBg={T.oliveLight}
                accentColor={T.olive}
                rank="3. plads"
                players={6}
                nextEvent="3 åbne kampe"
                onClick={() => router.push('/preview/gameroom?sport=football')}
              />
              <RoomCard
                name="Fantasy Manager"
                sport="Cykling · Ardennerne"
                icon={<Bike size={20} />}
                iconBg={T.skyLight}
                accentColor={T.sky}
                rank="5. plads"
                players={4}
                nextEvent="Roubaix søndag"
                onClick={() => router.push('/preview/gameroom?sport=cycling')}
              />
              <RoomCard
                name="Mesterskabet"
                sport="Fodbold · Bodega Rounds"
                icon={<Star size={20} />}
                iconBg={T.warmLight}
                accentColor={T.warm}
                rank="2. plads"
                players={8}
                nextEvent="Uge 28 aktiv"
                onClick={() => router.push('/preview/gameroom?sport=football')}
              />
              <RoomCard
                name="Giro Manager"
                sport="Cykling · Giro d'Italia"
                icon={<Bike size={20} />}
                iconBg={T.terracottaLight}
                accentColor={T.terracotta}
                rank="—"
                players={6}
                nextEvent="Starter 9. maj"
                onClick={() => router.push('/preview/gameroom?sport=cycling')}
              />
            </div>
          </div>

          {/* Right sidebar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Upcoming */}
            <div style={{
              background: T.white, borderRadius: 20, padding: '20px 22px',
              border: `1px solid ${T.border}`,
            }}>
              <div style={{ fontFamily: F, fontSize: 13, fontWeight: 700, color: T.ink, marginBottom: 16 }}>
                Kommende
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <TimelineItem time="I DAG" text="3 kampe åbne i Bodega Betting" accent={T.olive} />
                <TimelineItem time="LØRDAG" text="Bets lukker kl. 13:00" accent={T.terracotta} />
                <TimelineItem time="SØNDAG" text="Paris–Roubaix · Lineup låser 10:00" accent={T.sky} />
                <TimelineItem time="MANDAG" text="Uge 28 afslutning · Point beregnes" accent={T.warm} />
              </div>
            </div>

            {/* Mini leaderboard */}
            <div style={{
              background: T.white, borderRadius: 20, padding: '20px 22px',
              border: `1px solid ${T.border}`,
            }}>
              <div style={{ fontFamily: F, fontSize: 13, fontWeight: 700, color: T.ink, marginBottom: 14 }}>
                Bodega Betting · Top 3
              </div>
              {[
                { rank: 1, name: 'Jonas', pts: 148, delta: '+12' },
                { rank: 2, name: 'Peter', pts: 138, delta: '—' },
                { rank: 3, name: 'Mikkel', pts: 124, delta: '+8' },
              ].map((p) => (
                <div key={p.name} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '9px 10px', borderRadius: 12,
                  background: p.rank === 3 ? T.olivePale : 'transparent',
                }}>
                  <span style={{
                    fontFamily: F, fontSize: 13, fontWeight: 800, width: 18,
                    color: p.rank === 1 ? '#D4A843' : p.rank === 2 ? '#A0A0A0' : T.t3,
                  }}>{p.rank}</span>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%',
                    background: p.rank === 3 ? T.sageDeep : T.sand,
                    color: p.rank === 3 ? T.oliveLight : T.t2,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 9, fontWeight: 800,
                  }}>{p.name.slice(0, 2).toUpperCase()}</div>
                  <span style={{ flex: 1, fontFamily: F, fontSize: 13, fontWeight: p.rank === 3 ? 700 : 500, color: T.ink }}>{p.name}</span>
                  <span style={{ fontFamily: F, fontSize: 14, fontWeight: 800, color: T.ink }}>{p.pts}</span>
                  <span style={{
                    fontFamily: F, fontSize: 10, fontWeight: 700, width: 28, textAlign: 'right',
                    color: p.delta.startsWith('+') ? T.olive : T.t3,
                  }}>{p.delta}</span>
                </div>
              ))}
            </div>

            {/* Activity */}
            <div style={{
              background: T.white, borderRadius: 20, padding: '20px 22px',
              border: `1px solid ${T.border}`,
            }}>
              <div style={{ fontFamily: F, fontSize: 13, fontWeight: 700, color: T.ink, marginBottom: 14 }}>
                Seneste aktivitet
              </div>
              {[
                { text: 'Jonas spillede FCK i Superliga-derby', time: '2 timer siden' },
                { text: 'Peter ændrede sin Roubaix-lineup', time: '4 timer siden' },
                { text: 'Uge 27 afsluttet — du scorede +18', time: 'i går' },
              ].map((a, i) => (
                <div key={i} style={{
                  padding: '10px 0',
                  borderBottom: i < 2 ? `1px solid ${T.borderLight}` : 'none',
                }}>
                  <div style={{ fontFamily: F, fontSize: 12, color: T.ink }}>{a.text}</div>
                  <div style={{ fontFamily: F, fontSize: 10, color: T.t3, marginTop: 2 }}>{a.time}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
