'use client'

import { useState } from 'react'
import { Trophy, Calendar, Flag } from 'lucide-react'
import CyclingCurrentStanding from './CyclingCurrentStanding'
import CyclingSeasonOverview from './CyclingSeasonOverview'

type Props = {
  gameId: number
  /** Aktive sub-blok-navn (fx "Uge 2") — kolonne-overskrift i det aktive spil. */
  activeBlockName: string | null
  /** Navn på den nuværende TOP-blok (fx "Tour de France") — det aktive spil. */
  metaBlockName: string | null
  activeBlockStatus: 'upcoming' | 'active' | 'finished' | null
}

type TabId = 'block' | 'season'

/**
 * Konsolideret rangliste-container med tabs for blok-stilling og sæson-overblik.
 *
 * Tidligere blev disse renderet som separate sektioner i gameroom-main —
 * sammen med sidebar-leaderboard'en gav det fire forskellige "scoreboard"-
 * visninger. Nu er de samlet i én komponent hvor brugeren toggler mellem
 * relevante perspektiver.
 *
 * "Blok"-tabben er default fordi den er mest aktuel for igangværende race.
 * Når intet blok er aktivt (alle finished), starter vi på "Sæson".
 */
export default function CyclingRanglister({ gameId, activeBlockName, metaBlockName, activeBlockStatus }: Props) {
  const defaultTab: TabId = activeBlockStatus && activeBlockStatus !== 'finished' ? 'block' : 'season'
  const [tab, setTab] = useState<TabId>(defaultTab)

  // Første fane = det NUVÆRENDE spil (den aktive top-blok). Navngives efter
  // løbet, så den illustrerer det aktive spil frem for et generisk "Blok".
  const TABS: Array<{ id: TabId; label: string; icon: React.ComponentType<{ size?: number; strokeWidth?: number }> }> = [
    { id: 'block', label: metaBlockName ?? 'Aktivt', icon: Flag },
    { id: 'season', label: 'Sæson', icon: Calendar },
  ]

  return (
    <div style={{
      background: '#FDFAF5',
      border: '1px solid #E8E0D3',
      borderRadius: 2,
      overflow: 'hidden',
    }}>
      {/* Header med "RANGLISTE" + tabs */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 16,
        padding: '14px 16px 0',
        borderBottom: '1px solid #E8E0D3',
      }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          paddingBottom: 12,
        }}>
          <Trophy size={11} strokeWidth={2.4} color="#6b6b6b" />
          <span style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: 11, fontWeight: 700, letterSpacing: '0.14em',
            textTransform: 'uppercase', color: '#6b6b6b',
          }}>
            Rangliste
          </span>
        </div>
        <div style={{
          display: 'flex', gap: 0, marginLeft: 'auto',
          alignSelf: 'flex-end',
        }}>
          {TABS.map(({ id, label, icon: Icon }) => {
            const isActive = tab === id
            return (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                style={{
                  padding: '8px 14px 10px',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: isActive ? '2px solid #1E3A5F' : '2px solid transparent',
                  marginBottom: -1,
                  cursor: 'pointer',
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontSize: 12, fontWeight: 700,
                  letterSpacing: '0.06em', textTransform: 'uppercase',
                  color: isActive ? '#1E3A5F' : '#6b6b6b',
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  transition: 'color 0.15s',
                }}
              >
                <Icon size={11} strokeWidth={2.4} />
                {label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Tab content — bruger eksisterende komponenter, fjerner deres egne
          ydre cards så de glider rent ind i container'en */}
      <div style={{ padding: '0', background: '#FDFAF5' }}>
        {tab === 'block' && (
          <div style={{ padding: '4px 0' }}>
            <CyclingCurrentStanding
              gameId={gameId}
              metaBlockName={metaBlockName}
              subBlockName={activeBlockName}
              blockStatus={activeBlockStatus}
              embedded
            />
          </div>
        )}
        {tab === 'season' && (
          <div style={{ padding: '4px 0' }}>
            <CyclingSeasonOverview gameId={gameId} embedded />
          </div>
        )}
      </div>
    </div>
  )
}
