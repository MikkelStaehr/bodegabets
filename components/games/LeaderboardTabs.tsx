'use client'

import { useState } from 'react'
import type { LeaderboardTabs, LbTabRow } from '@/lib/gameState'
import PlayerHistoryModal from './PlayerHistoryModal'

type Props = {
  tabs: LeaderboardTabs
  gameId: number
}

const C = {
  ink: '#1a1a1a', muted: '#9E9486', border: '#E8E0D3', bg: '#FDFAF5',
  gold: '#B8963E', green: '#2C4A3E', red: '#C8392B', highlight: '#F8F5ED',
}
const FF = "'Barlow Condensed', sans-serif"
const profitStr = (n: number) => (n >= 0 ? `+${n}` : `${n}`)

export default function LeaderboardTabs({ tabs, gameId }: Props) {
  const hasBlock = !!tabs.block && tabs.block.rows.length > 0
  const [tab, setTab] = useState<'block' | 'season'>(hasBlock ? 'block' : 'season')
  const [selected, setSelected] = useState<{ userId: string; username: string } | null>(null)

  const active = tab === 'block' && hasBlock ? 'block' : 'season'
  const rows = active === 'block' ? tabs.block!.rows : tabs.season.rows

  return (
    <div>
      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
        <TabBtn label="Blok" sub={tabs.block?.block_name} activeTab={active === 'block'} disabled={!hasBlock} onClick={() => setTab('block')} />
        <TabBtn label="Sæson" sub="Hele spillet" activeTab={active === 'season'} onClick={() => setTab('season')} />
      </div>

      {active === 'block' && tabs.block && tabs.block.rounds_remaining > 0 && (
        <p style={{ fontFamily: FF, fontSize: 10, color: C.muted, margin: '0 0 6px' }}>
          {tabs.block.rounds_remaining} runde{tabs.block.rounds_remaining !== 1 ? 'r' : ''} tilbage i blokken
        </p>
      )}

      <Table rows={rows} variant={active} onSelect={(r) => setSelected({ userId: r.user_id, username: r.username })} />

      {selected && (
        <PlayerHistoryModal gameId={gameId} userId={selected.userId} username={selected.username} onClose={() => setSelected(null)} />
      )}
    </div>
  )
}

function TabBtn({ label, sub, activeTab, disabled, onClick }: { label: string; sub?: string; activeTab: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      style={{
        flex: 1, padding: '7px 10px', borderRadius: 2, border: `1px solid ${activeTab ? C.green : C.border}`,
        background: activeTab ? C.green : '#fff', cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.45 : 1, textAlign: 'left',
      }}
    >
      <span style={{ display: 'block', fontFamily: FF, fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: activeTab ? '#F2EDE4' : C.ink }}>
        {label}
      </span>
      {sub && (
        <span style={{ display: 'block', fontFamily: FF, fontSize: 9, color: activeTab ? 'rgba(242,237,228,0.65)' : C.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {sub}
        </span>
      )}
    </button>
  )
}

function Table({ rows, variant, onSelect }: { rows: LbTabRow[]; variant: 'block' | 'season'; onSelect: (r: LbTabRow) => void }) {
  const cols = variant === 'season'
    ? '34px minmax(60px, 1fr) 80px 34px 34px'
    : '34px minmax(60px, 1fr) 88px'
  const headers = variant === 'season'
    ? [
        { l: '#', t: 'Placering — pilen viser bevægelse siden forrige spillede runde', a: 'left' as const },
        { l: 'Spiller', t: 'Spiller — tryk for fuld historik', a: 'left' as const },
        { l: 'Point', t: 'Samlet point over hele turneringen (+/− netto-profit)', a: 'right' as const },
        { l: 'MoM', t: 'Man of the Match — antal runder som topscorer', a: 'right' as const },
        { l: '🏅', t: 'Blokke vundet — afgør hvem der fører', a: 'right' as const },
      ]
    : [
        { l: '#', t: 'Placering — pilen viser bevægelse siden forrige runde i blokken', a: 'left' as const },
        { l: 'Spiller', t: 'Spiller — tryk for fuld historik', a: 'left' as const },
        { l: 'Point', t: 'Point i den nuværende blok (+/− netto-profit)', a: 'right' as const },
      ]

  if (rows.length === 0) {
    return <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 2, padding: '24px 12px', textAlign: 'center', fontFamily: "'Barlow', sans-serif", fontSize: 13, color: C.muted }}>Ingen point endnu</div>
  }

  return (
    <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 2, overflow: 'visible' }}>
      {/* Header */}
      <div style={{ display: 'grid', gridTemplateColumns: cols, padding: '7px 10px', borderBottom: `1px solid ${C.border}`, gap: 4 }}>
        {headers.map((h, i) => (
          <Th key={i} label={h.l} tip={h.t} align={h.a} />
        ))}
      </div>
      {/* Rows */}
      {rows.map((r, idx) => (
        <div
          key={r.user_id}
          onClick={() => onSelect(r)}
          style={{
            display: 'grid', gridTemplateColumns: cols, padding: '7px 10px', gap: 4, alignItems: 'center',
            borderBottom: idx < rows.length - 1 ? `1px solid ${C.border}` : 'none',
            background: idx === 0 ? C.highlight : 'transparent', cursor: 'pointer',
          }}
        >
          {/* Pos + bevægelse */}
          <span style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
            <span style={{ fontFamily: FF, fontSize: 13, fontWeight: 700, color: idx === 0 ? C.gold : idx === 1 ? '#7A7A7A' : idx === 2 ? '#A0785A' : C.muted }}>
              {r.rank}
            </span>
            <Move delta={r.rank_delta} />
          </span>
          {/* Spiller */}
          <span style={{ fontFamily: FF, fontSize: 13, fontWeight: 600, color: C.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>
            {r.username}
            {variant === 'season' && r.won_latest_block && <span title="Vinder af seneste blok" style={{ marginLeft: 4, fontSize: 12 }}>🏅</span>}
          </span>
          {/* Point (+/- profit) */}
          <span style={{ textAlign: 'right', lineHeight: 1.05 }}>
            <span style={{ fontFamily: FF, fontSize: 15, fontWeight: 800, color: r.points > 0 ? C.ink : '#ccc' }}>
              {r.points > 0 ? r.points : '-'}
            </span>
            {r.profit !== 0 && (
              <span style={{ fontFamily: FF, fontSize: 11, fontWeight: 700, marginLeft: 4, color: r.profit > 0 ? C.green : C.red }}>
                ({profitStr(r.profit)})
              </span>
            )}
          </span>
          {/* Sæson: MoM + Blokke */}
          {variant === 'season' && (
            <>
              <span style={{ textAlign: 'right', fontFamily: FF, fontSize: 14, fontWeight: 700, color: r.mvp_count > 0 ? '#7a7060' : '#ccc' }}>
                {r.mvp_count > 0 ? r.mvp_count : '-'}
              </span>
              <span style={{ textAlign: 'right', fontFamily: FF, fontSize: 14, fontWeight: 800, color: r.block_wins > 0 ? C.gold : '#ccc' }}>
                {r.block_wins > 0 ? r.block_wins : '-'}
              </span>
            </>
          )}
        </div>
      ))}
    </div>
  )
}

function Move({ delta }: { delta: number }) {
  if (delta === 0) return <span style={{ fontSize: 9, color: '#c4bdb0' }}>=</span>
  const up = delta > 0
  return (
    <span style={{ fontSize: 9, fontWeight: 700, color: up ? C.green : C.red }}>
      {up ? '▲' : '▼'}{Math.abs(delta)}
    </span>
  )
}

function Th({ label, tip, align }: { label: string; tip: string; align: 'left' | 'right' }) {
  const [show, setShow] = useState(false)
  return (
    <span
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onClick={(e) => { e.stopPropagation(); setShow((s) => !s) }}
      style={{ position: 'relative', textAlign: align, cursor: 'help', fontFamily: FF, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.muted }}
    >
      {label}
      {show && (
        <span style={{
          position: 'absolute', top: '140%', [align]: 0, zIndex: 20,
          background: '#1a3329', color: '#F2EDE4', fontFamily: "'Barlow', sans-serif",
          fontSize: 10, fontWeight: 400, letterSpacing: 0, textTransform: 'none',
          padding: '6px 8px', borderRadius: 3, width: 150, lineHeight: 1.3,
          boxShadow: '0 4px 12px rgba(0,0,0,0.18)', whiteSpace: 'normal', textAlign: 'left',
        } as React.CSSProperties}>
          {tip}
        </span>
      )}
    </span>
  )
}
