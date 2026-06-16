'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { BLOCK_BET_MARKETS } from '@/lib/blockBets'

export type BlockBetPick = { market_key: string; selection: string; stake: number; odds?: number; result?: string; points_earned?: number | null }

type Props = {
  gameId: number
  blockId: number
  blockName: string
  matchCount: number
  /** Brugerens allerede-placerede Blok Bets. */
  initialBets: BlockBetPick[]
  /** Kan der stadig placeres (blokken er ikke gået i gang)? */
  placeable: boolean
  /** Credits brugt på kamp-bets i blokken (deler det fælles budget). */
  spentOnMatches: number
}

// Blok Bets deler blokkens samlede budget med kamp-bets — spilleren fordeler frit.
const BUDGET = 1250

export default function BlockBetsPanel({ gameId, blockId, blockName, matchCount, initialBets, placeable, spentOnMatches }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(initialBets.length > 0 || placeable)
  const [picks, setPicks] = useState<Record<string, { selection: string; stake: number }>>(() => {
    const m: Record<string, { selection: string; stake: number }> = {}
    for (const b of initialBets) m[b.market_key] = { selection: b.selection, stake: b.stake }
    return m
  })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)

  const blockTotal = useMemo(() => Object.values(picks).reduce((s, p) => s + (p.stake || 0), 0), [picks])
  const remaining = BUDGET - spentOnMatches - blockTotal

  function toggle(marketKey: string, selection: string) {
    if (!placeable) return
    setPicks((prev) => {
      const cur = prev[marketKey]
      if (cur?.selection === selection) {
        const rest = { ...prev }
        delete rest[marketKey]
        return rest
      }
      return { ...prev, [marketKey]: { selection, stake: cur?.stake ?? 50 } }
    })
  }
  function setStake(marketKey: string, stake: number) {
    setPicks((prev) => (prev[marketKey] ? { ...prev, [marketKey]: { ...prev[marketKey], stake: Math.max(10, stake) } } : prev))
  }

  async function save() {
    setSaving(true); setMsg(null)
    const bets = Object.entries(picks).map(([market_key, p]) => ({ market_key, selection: p.selection, stake: p.stake }))
    const res = await fetch(`/api/blocks/${blockId}/bets`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ game_id: gameId, bets }),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { setMsg({ text: data.error ?? 'Noget gik galt', ok: false }); return }
    setMsg({ text: 'Blok Bets gemt ✓', ok: true })
    router.refresh()
  }

  return (
    <div className="mt-3">
      <div className="bg-white border border-black/10 rounded-sm overflow-hidden">
        <button type="button" onClick={() => setOpen((o) => !o)} className="w-full flex items-center gap-2 px-3.5 py-2.5 text-left">
          <span className="text-[14px]">🎯</span>
          <span className="flex-1">
            <span className="block font-condensed text-[14px] font-bold text-[var(--color-dark-green)] tracking-wide uppercase">Blok Bets</span>
            <span className="block text-[10px] text-[var(--color-warm-taupe)]">{blockName} · deler blokkens {BUDGET} credits{placeable ? '' : ' · låst'}</span>
          </span>
          <span className={`text-[10px] text-[var(--color-warm-taupe)] transition-transform ${open ? 'rotate-180' : ''}`}>▼</span>
        </button>

        {open && (
          <div className="px-3.5 pb-3 flex flex-col gap-2.5 border-t border-black/[0.06] pt-3">
            {BLOCK_BET_MARKETS.map((market) => {
              const pick = picks[market.key]
              const sides = market.sides(matchCount)
              return (
                <div key={market.key} className="border border-black/[0.07] rounded-sm p-2.5">
                  <p className="font-condensed text-[12px] font-bold text-[var(--color-dark-green)]">{market.label}</p>
                  <p className="text-[10px] text-[var(--color-warm-taupe)] mb-1.5 leading-snug">{market.describe(matchCount)}</p>
                  <div className="flex gap-1.5">
                    {sides.map((side) => {
                      const active = pick?.selection === side.value
                      return (
                        <button
                          key={side.value} type="button" disabled={!placeable}
                          onClick={() => toggle(market.key, side.value)}
                          className={`flex-1 py-1.5 rounded-sm border-[1.5px] text-[11px] font-semibold transition-all ${
                            active ? 'bg-[var(--color-card-green)] border-[#2C4A3E] text-white'
                              : 'bg-white border-black/10 text-[var(--color-warm-taupe)] hover:border-[#2C4A3E] disabled:opacity-50'
                          }`}
                        >
                          {side.label} <span className="opacity-70">@{side.odds}</span>
                        </button>
                      )
                    })}
                  </div>
                  {pick && placeable && (
                    <div className="flex items-center gap-1 mt-2">
                      <button type="button" onClick={() => setStake(market.key, (pick.stake || 50) - 50)} className="w-6 h-6 border border-black/10 rounded bg-[var(--color-cream)] text-[var(--color-dark-green)] font-bold text-sm flex items-center justify-center">−</button>
                      <input type="number" min={10} value={pick.stake}
                        onChange={(e) => setStake(market.key, parseInt(e.target.value) || 10)}
                        className="w-16 text-center font-condensed text-[13px] font-bold border border-black/10 rounded bg-[var(--color-cream)] h-6 text-[var(--color-dark-green)]" />
                      <span className="text-[10px] font-semibold text-[var(--color-warm-taupe)]">credits</span>
                      <button type="button" onClick={() => setStake(market.key, (pick.stake || 50) + 50)} className="w-6 h-6 border border-black/10 rounded bg-[var(--color-cream)] text-[var(--color-dark-green)] font-bold text-sm flex items-center justify-center">+</button>
                    </div>
                  )}
                  {pick && !placeable && (
                    <p className="text-[11px] text-[var(--color-dark-green)] mt-1.5 font-semibold">{pick.stake} credits @ {sides.find((s) => s.value === pick.selection)?.odds}</p>
                  )}
                </div>
              )
            })}

            {placeable ? (
              <div className="flex items-center justify-between gap-3 mt-0.5">
                <span className="text-[11px] text-[var(--color-warm-taupe)]">
                  Brugt: <strong className="text-[var(--color-dark-green)]">{blockTotal}</strong> · tilbage af {BUDGET}: <strong className={remaining < 0 ? 'text-[var(--color-red-dark)]' : 'text-[var(--color-dark-green)]'}>{remaining}</strong>
                </span>
                <button type="button" onClick={save} disabled={saving || remaining < 0}
                  className="h-[36px] px-4 rounded-sm bg-gold text-[var(--color-dark-green)] font-condensed text-[13px] font-bold tracking-wider disabled:opacity-50 hover:bg-[#d4aa55] transition-colors">
                  {saving ? 'Gemmer…' : 'Lås Blok Bets'}
                </button>
              </div>
            ) : (
              <p className="text-[11px] text-[var(--color-warm-taupe)] mt-0.5">🔒 Blokken er gået i gang — Blok Bets er låst.</p>
            )}
            {msg && <p className={`text-[11px] font-semibold ${msg.ok ? 'text-[var(--color-success)]' : 'text-[var(--color-red-dark)]'}`}>{msg.text}</p>}
          </div>
        )}
      </div>
    </div>
  )
}
