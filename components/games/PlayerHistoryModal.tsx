'use client'

import { useEffect, useState } from 'react'
import type { PlayerHistory } from '@/lib/gameState'
import { BET_TYPE_LABELS } from '@/lib/betTypes'

type Props = {
  gameId: number
  userId: string
  username: string
  onClose: () => void
}

const fmt = (n: number) => (n >= 0 ? `+${n}` : `${n}`)

export default function PlayerHistoryModal({ gameId, userId, username, onClose }: Props) {
  const [data, setData] = useState<PlayerHistory | null>(null)
  const [loading, setLoading] = useState(true)
  const [openRound, setOpenRound] = useState<number | null>(null)

  useEffect(() => {
    let alive = true
    fetch(`/api/games/${gameId}/player-history?userId=${userId}`)
      .then((r) => r.json())
      .then((d) => { if (alive) { setData(d.history ?? null); setLoading(false) } })
      .catch(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [gameId, userId])

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/55 px-4 py-8 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-cream border border-warm-border rounded-sm w-full max-w-[460px] shadow-xl"
        style={{ animation: 'fadeSlideIn 0.2s ease' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-forest rounded-t-sm px-5 py-3.5 flex items-center justify-between">
          <div>
            <p className="font-condensed text-[10px] font-bold tracking-[0.14em] uppercase text-gold">Historik</p>
            <h2 className="font-display text-[20px] font-bold text-cream leading-tight">{data?.username ?? username}</h2>
          </div>
          <button onClick={onClose} className="text-cream/70 hover:text-cream text-[20px] leading-none px-1">✕</button>
        </div>

        {/* Totals */}
        {data && (
          <div className="grid grid-cols-3 border-b border-warm-border bg-cream-dark">
            <Stat label="Satset" value={String(data.totals.staked)} />
            <Stat label="Vundet" value={String(data.totals.won)} />
            <Stat label="Profit" value={fmt(data.totals.net)} tone={data.totals.net >= 0 ? 'pos' : 'neg'} />
          </div>
        )}

        {/* Rounds */}
        <div className="max-h-[60vh] overflow-y-auto p-3">
          {loading ? (
            <p className="text-center text-[13px] text-warm-gray py-8">Henter…</p>
          ) : !data || data.rounds.length === 0 ? (
            <p className="text-center text-[13px] text-warm-gray py-8">Ingen bets endnu.</p>
          ) : (
            <div className="space-y-1.5">
              {data.rounds.map((r) => {
                const open = openRound === r.round_id
                return (
                  <div key={r.round_id} className="border border-warm-border rounded-sm bg-white overflow-hidden">
                    <button
                      onClick={() => setOpenRound(open ? null : r.round_id)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-condensed text-[13px] font-bold text-forest leading-tight truncate">
                          {r.round_name}
                          {r.block_number != null && (
                            <span className="text-[10px] font-semibold text-warm-gray"> · Blok {r.block_number}</span>
                          )}
                        </p>
                        <p className="text-[10px] text-warm-gray">
                          {r.settled ? `Satset ${r.staked} · vundet ${r.won}` : 'Afventer resultat'}
                        </p>
                      </div>
                      {r.settled && (
                        <span className={`font-condensed text-[15px] font-bold ${r.net >= 0 ? 'text-forest' : 'text-vintage-red'}`}>
                          {fmt(r.net)}
                        </span>
                      )}
                      <span className={`text-[10px] text-warm-gray transition-transform ${open ? 'rotate-180' : ''}`}>▼</span>
                    </button>
                    {open && (
                      <div className="border-t border-warm-border px-3 py-2 space-y-1.5 bg-cream-dark/40">
                        {r.bets.map((b, i) => (
                          <div key={i} className="flex items-center gap-2 text-[11px]">
                            <span className="flex-1 min-w-0 truncate text-ink">
                              <span className="text-warm-gray">{BET_TYPE_LABELS[b.bet_type] ?? b.bet_type}:</span>{' '}
                              <strong>{b.prediction}</strong> · {b.label}
                            </span>
                            <span className="text-warm-gray shrink-0">{b.stake}{b.odds != null ? ` × ${b.odds.toFixed(2)}` : ''}</span>
                            <span className={`shrink-0 w-10 text-right font-bold ${
                              b.result === 'win' ? 'text-forest' : b.result === 'loss' ? 'text-vintage-red' : 'text-warm-gray'
                            }`}>
                              {b.result === 'win' ? `+${b.points_earned ?? 0}` : b.result === 'loss' ? `−${b.stake}` : '—'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'pos' | 'neg' }) {
  const color = tone === 'pos' ? 'text-forest' : tone === 'neg' ? 'text-vintage-red' : 'text-ink'
  return (
    <div className="px-3 py-2.5 text-center border-r border-warm-border last:border-r-0">
      <p className="font-condensed text-[9px] font-bold tracking-[0.1em] uppercase text-warm-gray">{label}</p>
      <p className={`font-condensed text-[18px] font-extrabold leading-tight ${color}`}>{value}</p>
    </div>
  )
}
