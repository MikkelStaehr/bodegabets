'use client'

import { useEffect, useMemo, useState } from 'react'
import { X, ArrowRight, AlertCircle } from 'lucide-react'
import TeamLogo from './TeamLogo'
import CatBadge from './CatBadge'

type SquadRider = {
  id: string
  first_name: string
  last_name: string
  team_name: string
  category: number
  team_logo_url: string | null
  photo_url: string | null
}

type StartlistRider = SquadRider & { confirmed: boolean }

type Transfer = {
  id: string
  rider_out_id: string
  rider_in_id: string
  rider_in_category: number
  created_at: string
}

type Props = {
  gameId: number
  raceId: string
  raceName: string
  restDayDate: string
  onClose: () => void
  onSaved: () => void
}

const MAX_SWAPS = 5 // matcher MAX_TRANSFERS_PER_REST_DAY server-side
// Standard kategori-grænser (matcher DEFAULT_CAT_LIMITS i lib/cyclingSquadLimits).
// Defineret lokalt fordi det modul er server-only (importerer supabase).
const CAT_LIMITS: Record<number, number> = { 1: 3, 2: 5, 3: 5, 4: 5, 5: 7 }

export default function TransferModal({
  gameId,
  raceId,
  raceName,
  restDayDate,
  onClose,
  onSaved,
}: Props) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentSquad, setCurrentSquad] = useState<SquadRider[]>([])
  const [startlist, setStartlist] = useState<StartlistRider[]>([])
  const [existingTransfers, setExistingTransfers] = useState<Transfer[]>([])
  const [swaps, setSwaps] = useState<{ out: string; in: string | null }[]>([])
  const [pickingInFor, setPickingInFor] = useState<number | null>(null)

  // ── Load data ────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const [squadRes, startlistRes, transferRes] = await Promise.all([
          fetch(`/api/games/${gameId}/cycling/squad?race_id=${raceId}&effective=true&before=${restDayDate}`),
          fetch(`/api/games/${gameId}/cycling/startlist?race_id=${raceId}`),
          fetch(`/api/games/${gameId}/cycling/transfer?race_id=${raceId}&rest_day_date=${restDayDate}`),
        ])
        if (cancelled) return
        const squadData = await squadRes.json()
        const startlistData = await startlistRes.json()
        const transferData = await transferRes.json()

        if (!squadRes.ok) throw new Error(squadData.error ?? 'Kunne ikke hente trup')
        if (!transferRes.ok) throw new Error(transferData.error ?? 'Kunne ikke hente transfers')

        setCurrentSquad(squadData.riders ?? [])
        setStartlist(startlistData.riders ?? [])
        setExistingTransfers(transferData.transfers ?? [])

        // Prefyld med eksisterende transfers
        const pre: { out: string; in: string }[] = (transferData.transfers ?? []).map((t: Transfer) => ({
          out: t.rider_out_id, in: t.rider_in_id,
        }))
        setSwaps(pre.length ? pre : [])
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Fejl')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [gameId, raceId, restDayDate])

  // ── Derived ──────────────────────────────────────────────
  const squadById = useMemo(() => {
    const m = new Map<string, SquadRider>()
    for (const r of currentSquad) m.set(r.id, r)
    return m
  }, [currentSquad])

  const startlistById = useMemo(() => {
    const m = new Map<string, StartlistRider>()
    for (const r of startlist) m.set(r.id, r)
    return m
  }, [startlist])

  // Kategori-fordeling EFTER de planlagte swaps (out fjernet, in tilføjet) — så
  // man kan se hvor mange man har af hver kategori mens man bytter.
  const catCounts = useMemo(() => {
    const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    const outSet = new Set(swaps.map((s) => s.out))
    for (const r of currentSquad) if (!outSet.has(r.id)) counts[r.category] = (counts[r.category] ?? 0) + 1
    for (const s of swaps) {
      if (s.in) { const ir = startlistById.get(s.in); if (ir) counts[ir.category] = (counts[ir.category] ?? 0) + 1 }
    }
    return counts
  }, [currentSquad, swaps, startlistById])

  const outIds = new Set(swaps.map((s) => s.out))
  const inIds = new Set(swaps.map((s) => s.in).filter(Boolean) as string[])

  // Kandidat-ryttere for swap IN: startliste minus nuværende trup minus allerede
  // valgte ins, OG kun SAMME kategori som den rytter man bytter ud (så kategori-
  // slots bevares — en Kat X kan kun byttes med en anden Kat X).
  const availableIns = useMemo(() => {
    if (pickingInFor === null) return []
    const currentIds = new Set(currentSquad.map((r) => r.id))
    const outRider = squadById.get(swaps[pickingInFor]?.out)
    const outCat = outRider?.category
    return startlist.filter(
      (r) => !currentIds.has(r.id) && !inIds.has(r.id) && (outCat == null || r.category === outCat),
    )
  }, [startlist, currentSquad, inIds, pickingInFor, swaps, squadById])

  const canAddMore = swaps.length < MAX_SWAPS

  // ── Handlers ─────────────────────────────────────────────
  function addSwap(riderOutId: string) {
    if (!canAddMore) return
    if (outIds.has(riderOutId)) return
    setSwaps([...swaps, { out: riderOutId, in: null }])
    setPickingInFor(swaps.length)
  }

  function setSwapIn(idx: number, riderInId: string) {
    const next = [...swaps]
    next[idx] = { ...next[idx], in: riderInId }
    setSwaps(next)
    setPickingInFor(null)
  }

  function removeSwap(idx: number) {
    setSwaps(swaps.filter((_, i) => i !== idx))
    setPickingInFor(null)
  }

  async function handleSave() {
    const complete = swaps.filter((s) => s.in).map((s) => ({
      rider_out_id: s.out,
      rider_in_id: s.in as string,
    }))
    if (complete.length === 0) {
      setError('Vælg mindst én swap')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/games/${gameId}/cycling/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          race_id: raceId,
          rest_day_date: restDayDate,
          swaps: complete,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Fejl ved gem')
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fejl')
    } finally {
      setSaving(false)
    }
  }

  // ── Render ───────────────────────────────────────────────
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#0F2137', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 2, maxWidth: 640, width: '100%',
          maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '14px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: 10, fontWeight: 700, color: '#8FABC4',
              textTransform: 'uppercase', letterSpacing: '0.08em',
            }}>
              Hviledag-transfer — {raceName}
            </div>
            <div style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: 16, fontWeight: 700, color: '#F2EDE4', marginTop: 2,
            }}>
              {new Date(restDayDate).toLocaleDateString('da-DK', { day: 'numeric', month: 'long' })}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: '#8FABC4', padding: 4, display: 'flex',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Info bar */}
        <div style={{
          padding: '8px 16px', background: '#162d4a',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12,
          color: '#8FABC4',
        }}>
          Du kan lave op til <strong style={{ color: '#F2EDE4' }}>{MAX_SWAPS} swaps</strong> pr. hviledag.
          {' '}Brugt: {swaps.length}/{MAX_SWAPS}.
        </div>

        {/* Kategori-tæller — opdaterer med de planlagte swaps */}
        <div style={{
          padding: '8px 16px', background: '#11243c',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center',
        }}>
          <span style={{
            fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10, fontWeight: 700,
            color: '#8FABC4', textTransform: 'uppercase', letterSpacing: '0.08em',
          }}>
            Kategorier
          </span>
          {[1, 2, 3, 4, 5].map((cat) => {
            const count = catCounts[cat] ?? 0
            const limit = CAT_LIMITS[cat] ?? 0
            const over = count > limit
            return (
              <span key={cat} style={{
                fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, fontWeight: 700,
                display: 'inline-flex', alignItems: 'center', gap: 4,
                color: over ? '#ff6b6b' : '#8FABC4',
              }}>
                <span style={{ color: over ? '#ff6b6b' : '#F2EDE4' }}>Kat {cat}</span>
                {count}/{limit}
              </span>
            )
          })}
        </div>

        {/* Body */}
        <div style={{ overflow: 'auto', flex: 1, padding: 16 }}>
          {loading && (
            <div style={{
              padding: 24, textAlign: 'center',
              fontFamily: "'Barlow', sans-serif", fontSize: 13, color: '#8FABC4',
            }}>
              Henter data...
            </div>
          )}

          {error && !loading && (
            <div style={{
              padding: 10, marginBottom: 12,
              background: 'rgba(255,107,107,0.1)', border: '1px solid #ff6b6b',
              borderRadius: 2, display: 'flex', alignItems: 'center', gap: 8,
              fontFamily: "'Barlow', sans-serif", fontSize: 12, color: '#ff6b6b',
            }}>
              <AlertCircle size={14} />{error}
            </div>
          )}

          {!loading && (
            <>
              {/* Planned swaps */}
              {swaps.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{
                    fontFamily: "'Barlow Condensed', sans-serif",
                    fontSize: 10, fontWeight: 700, color: '#8FABC4',
                    textTransform: 'uppercase', letterSpacing: '0.08em',
                    marginBottom: 8,
                  }}>
                    Planlagte swaps
                  </div>
                  {swaps.map((swap, idx) => {
                    const out = squadById.get(swap.out)
                    const inRider = swap.in ? startlistById.get(swap.in) : null
                    return (
                      <div
                        key={idx}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr auto 1fr auto',
                          alignItems: 'center', gap: 8,
                          padding: '8px 10px', marginBottom: 6,
                          background: '#162d4a', border: '1px solid rgba(255,255,255,0.06)',
                          borderRadius: 2,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                          {out && <TeamLogo url={out.team_logo_url} team={out.team_name} />}
                          <span style={{
                            fontFamily: "'Barlow Condensed', sans-serif",
                            fontSize: 13, fontWeight: 600, color: '#F2EDE4',
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                          }}>
                            {out ? out.last_name : '?'}
                          </span>
                          {out && <CatBadge cat={out.category} />}
                        </div>
                        <ArrowRight size={14} color="#8FABC4" />
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                          {inRider ? (
                            <>
                              <TeamLogo url={inRider.team_logo_url} team={inRider.team_name} />
                              <span style={{
                                fontFamily: "'Barlow Condensed', sans-serif",
                                fontSize: 13, fontWeight: 600, color: '#F2EDE4',
                                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                              }}>
                                {inRider.last_name}
                              </span>
                              <CatBadge cat={inRider.category} />
                            </>
                          ) : (
                            <button
                              onClick={() => setPickingInFor(idx)}
                              style={{
                                background: '#4A90D9', color: '#fff',
                                border: 'none', borderRadius: 2,
                                padding: '4px 10px', cursor: 'pointer',
                                fontFamily: "'Barlow Condensed', sans-serif",
                                fontSize: 11, fontWeight: 700,
                              }}
                            >
                              Vælg ind...
                            </button>
                          )}
                        </div>
                        <button
                          onClick={() => removeSwap(idx)}
                          style={{
                            background: 'transparent', border: 'none', cursor: 'pointer',
                            color: '#ff6b6b', padding: 4, display: 'flex',
                          }}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Picker for swap-in */}
              {pickingInFor !== null && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{
                    fontFamily: "'Barlow Condensed', sans-serif",
                    fontSize: 10, fontWeight: 700, color: '#8FABC4',
                    textTransform: 'uppercase', letterSpacing: '0.08em',
                    marginBottom: 8,
                  }}>
                    Vælg rytter ind — kun Kat {squadById.get(swaps[pickingInFor]?.out)?.category ?? '?'} (fra startliste)
                  </div>
                  <div style={{ maxHeight: 240, overflow: 'auto' }}>
                    {availableIns.length === 0 ? (
                      <div style={{
                        padding: 16, textAlign: 'center', color: '#8FABC4',
                        fontFamily: "'Barlow', sans-serif", fontSize: 12,
                      }}>
                        Ingen ryttere tilgængelige
                      </div>
                    ) : (
                      availableIns.map((r) => (
                        <button
                          key={r.id}
                          onClick={() => setSwapIn(pickingInFor, r.id)}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'auto 1fr auto',
                            alignItems: 'center', gap: 8,
                            width: '100%', padding: '8px 10px', marginBottom: 4,
                            background: '#162d4a', border: '1px solid rgba(255,255,255,0.06)',
                            borderRadius: 2, cursor: 'pointer',
                            fontFamily: "'Barlow Condensed', sans-serif",
                          }}
                        >
                          <TeamLogo url={r.team_logo_url} team={r.team_name} />
                          <span style={{
                            textAlign: 'left', fontSize: 13, fontWeight: 600, color: '#F2EDE4',
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                          }}>
                            {r.last_name} {r.first_name}
                          </span>
                          <CatBadge cat={r.category} />
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Current squad (click to add swap-out) */}
              {canAddMore && pickingInFor === null && (
                <div>
                  <div style={{
                    fontFamily: "'Barlow Condensed', sans-serif",
                    fontSize: 10, fontWeight: 700, color: '#8FABC4',
                    textTransform: 'uppercase', letterSpacing: '0.08em',
                    marginBottom: 8,
                  }}>
                    Din brutto-trup — klik for at bytte ud
                  </div>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                    gap: 4,
                  }}>
                    {currentSquad.map((r) => {
                      const isOut = outIds.has(r.id)
                      return (
                        <button
                          key={r.id}
                          onClick={() => addSwap(r.id)}
                          disabled={isOut}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'auto 1fr auto',
                            alignItems: 'center', gap: 6,
                            padding: '6px 8px',
                            background: isOut ? 'rgba(255,107,107,0.1)' : '#162d4a',
                            border: '1px solid rgba(255,255,255,0.06)',
                            borderRadius: 2,
                            cursor: isOut ? 'not-allowed' : 'pointer',
                            opacity: isOut ? 0.5 : 1,
                            fontFamily: "'Barlow Condensed', sans-serif",
                          }}
                        >
                          <TeamLogo url={r.team_logo_url} team={r.team_name} />
                          <span style={{
                            textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#F2EDE4',
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                          }}>
                            {r.last_name}
                          </span>
                          <CatBadge cat={r.category} />
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.08)',
          display: 'flex', justifyContent: 'flex-end', gap: 8,
        }}>
          <button
            onClick={onClose}
            disabled={saving}
            style={{
              padding: '8px 14px', background: 'transparent',
              border: '1px solid rgba(255,255,255,0.15)', borderRadius: 2,
              color: '#8FABC4', cursor: 'pointer',
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
            }}
          >
            Annullér
          </button>
          <button
            onClick={handleSave}
            disabled={saving || swaps.length === 0 || swaps.some((s) => !s.in)}
            style={{
              padding: '8px 14px',
              background: saving || swaps.length === 0 ? '#2B4F7A' : '#4A90D9',
              border: 'none', borderRadius: 2, color: '#fff',
              cursor: saving || swaps.length === 0 ? 'not-allowed' : 'pointer',
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
            }}
          >
            {saving ? 'Gemmer...' : existingTransfers.length > 0 ? 'Opdatér transfers' : 'Gem transfers'}
          </button>
        </div>
      </div>
    </div>
  )
}
