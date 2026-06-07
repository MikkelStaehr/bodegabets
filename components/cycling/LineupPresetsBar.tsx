'use client'

import { useState, useMemo } from 'react'
import { Bookmark, Plus, MoreHorizontal, Trash2, Save, X, AlertTriangle, Check } from 'lucide-react'
import type { CyclingLineupPreset, CyclingRoleKey, CyclingSquadRider } from '@/types/cycling'

const MAX_PRESETS = 5

type Props = {
  gameId: number
  squadId: string
  presets: CyclingLineupPreset[]
  /** Nuværende slots for den aktive stage — bruges når brugeren "gemmer som preset". */
  currentSlots: Partial<Record<CyclingRoleKey, string | null>>
  /** Aktive bloks squad-rytter-ids — preset må kun referere disse. */
  squadRiderIds: Set<string>
  /** rytter-id → rytter (til at vise navn i warnings/preview). */
  riderMap: Map<string, CyclingSquadRider>
  /** rytter-id → DNF/DNS/OTL/DSQ for den aktuelle race. */
  abandonedSet: Set<string>
  /** Startlist-set for den aktuelle race. null hvis ingen startliste sync'et. */
  startlistSet: Set<string> | null
  /** Anvendes når brugeren klikker et preset — vis preset-slots i UI'et. */
  onApply: (slots: Partial<Record<CyclingRoleKey, string | null>>) => void
  /** Kaldes når lokal state skal opdateres efter API-svar. */
  onPresetsChange: (presets: CyclingLineupPreset[]) => void
}

export default function LineupPresetsBar({
  gameId, squadId, presets, currentSlots, squadRiderIds, riderMap,
  abandonedSet, startlistSet, onApply, onPresetsChange,
}: Props) {
  const [saveOpen, setSaveOpen] = useState<{ slotIndex: number; name: string } | null>(null)
  const [menuOpen, setMenuOpen] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<{ presetName: string; missing: string[]; out: string[] } | null>(null)

  const squadPresets = useMemo(
    () => presets.filter((p) => p.squad_id === squadId).sort((a, b) => a.slot_index - b.slot_index),
    [presets, squadId],
  )
  const usedSlots = useMemo(() => new Set(squadPresets.map((p) => p.slot_index)), [squadPresets])
  const nextSlot = useMemo(() => {
    for (let i = 0; i < MAX_PRESETS; i++) if (!usedSlots.has(i)) return i
    return -1
  }, [usedSlots])

  /** Filtrér preset-slots: behold kun ryttere der stadig hører til squad'en. */
  function filterToOwnedRiders(slots: Partial<Record<CyclingRoleKey, string | null>>) {
    const out: Partial<Record<CyclingRoleKey, string | null>> = {}
    for (const [k, v] of Object.entries(slots)) {
      out[k as CyclingRoleKey] = v && squadRiderIds.has(v) ? v : null
    }
    return out
  }

  function ridersInPreset(slots: Partial<Record<CyclingRoleKey, string | null>>) {
    const owned = filterToOwnedRiders(slots)
    const ids = Object.values(owned).filter((v): v is string => v !== null)
    return { owned, ids }
  }

  function classifyForWarning(ids: string[]) {
    const out: string[] = []
    const missing: string[] = []
    for (const id of ids) {
      const rider = riderMap.get(id)
      const label = rider ? `${rider.last_name}` : id.slice(0, 6)
      if (abandonedSet.has(id)) out.push(label)
      else if (startlistSet && !startlistSet.has(id)) missing.push(label)
    }
    return { missing, out }
  }

  function handleApply(preset: CyclingLineupPreset) {
    const { owned, ids } = ridersInPreset(preset.slots)
    // Tøm slots for ryttere der er DNF/DSQ eller ikke på startlisten
    const finalSlots: Partial<Record<CyclingRoleKey, string | null>> = {}
    for (const [k, v] of Object.entries(owned)) {
      if (v === null) { finalSlots[k as CyclingRoleKey] = null; continue }
      if (abandonedSet.has(v)) { finalSlots[k as CyclingRoleKey] = null; continue }
      if (startlistSet && !startlistSet.has(v)) { finalSlots[k as CyclingRoleKey] = null; continue }
      finalSlots[k as CyclingRoleKey] = v
    }
    onApply(finalSlots)
    const { missing, out } = classifyForWarning(ids)
    if (missing.length > 0 || out.length > 0) {
      setWarning({ presetName: preset.name, missing, out })
    } else {
      setWarning(null)
    }
    setMenuOpen(null)
  }

  async function handleSave(slotIndex: number, name: string) {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/games/${gameId}/cycling/presets`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ squad_id: squadId, slot_index: slotIndex, name: name.trim(), slots: currentSlots }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Kunne ikke gemme preset')
        return
      }
      const next = squadPresets.filter((p) => p.slot_index !== slotIndex)
      next.push(data.preset as CyclingLineupPreset)
      const otherSquads = presets.filter((p) => p.squad_id !== squadId)
      onPresetsChange([...otherSquads, ...next])
      setSaveOpen(null)
    } catch {
      setError('Noget gik galt')
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete(slotIndex: number) {
    if (busy) return
    setBusy(true)
    try {
      const res = await fetch(`/api/games/${gameId}/cycling/presets?squad_id=${squadId}&slot_index=${slotIndex}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError((data as { error?: string }).error ?? 'Kunne ikke slette')
        return
      }
      const next = squadPresets.filter((p) => p.slot_index !== slotIndex)
      const otherSquads = presets.filter((p) => p.squad_id !== squadId)
      onPresetsChange([...otherSquads, ...next])
      setMenuOpen(null)
    } catch {
      setError('Noget gik galt')
    } finally {
      setBusy(false)
    }
  }

  const hasCurrentSlots = Object.values(currentSlots).some((v) => v !== null)

  return (
    <div style={{
      padding: '8px 14px 10px',
      borderTop: '1px solid rgba(255,255,255,0.06)',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
    }}>
      {/* ── Header ────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8,
      }}>
        <Bookmark size={11} color="#8FABC4" strokeWidth={2.4} />
        <span style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
          textTransform: 'uppercase', color: '#8FABC4',
        }}>
          Lineup-presets
        </span>
        <span style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          fontSize: 10, color: 'rgba(143,171,196,0.5)',
        }}>
          ({squadPresets.length}/{MAX_PRESETS})
        </span>
      </div>

      {/* ── Preset buttons ────────────────────────────────── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {squadPresets.map((p) => {
          const { ids } = ridersInPreset(p.slots)
          const isOpen = menuOpen === p.id
          return (
            <div key={p.id} style={{ position: 'relative', display: 'inline-flex' }}>
              <button
                type="button"
                onClick={() => handleApply(p)}
                title={`${p.name} — ${ids.length} ryttere`}
                style={{
                  padding: '6px 10px',
                  background: 'rgba(74,144,217,0.12)',
                  border: '1px solid rgba(74,144,217,0.35)',
                  borderRight: 'none',
                  borderRadius: '2px 0 0 2px',
                  cursor: 'pointer',
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontSize: 12, fontWeight: 700,
                  color: '#8FBEDF',
                  letterSpacing: '0.04em',
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                }}
              >
                {p.name}
                <span style={{
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontSize: 9, fontWeight: 600,
                  color: 'rgba(143,190,223,0.7)',
                }}>
                  {ids.length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setMenuOpen(isOpen ? null : p.id)}
                title="Indstillinger"
                style={{
                  padding: '6px 6px',
                  background: 'rgba(74,144,217,0.12)',
                  border: '1px solid rgba(74,144,217,0.35)',
                  borderRadius: '0 2px 2px 0',
                  cursor: 'pointer', color: '#8FBEDF',
                  display: 'inline-flex', alignItems: 'center',
                }}
              >
                <MoreHorizontal size={11} />
              </button>
              {isOpen && (
                <div style={{
                  position: 'absolute', top: 'calc(100% + 4px)', left: 0,
                  background: '#0F2137', border: '1px solid #2B4F7A',
                  borderRadius: 2, padding: 4, zIndex: 20,
                  minWidth: 160, boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                }}>
                  <button
                    type="button"
                    disabled={!hasCurrentSlots || busy}
                    onClick={() => { setSaveOpen({ slotIndex: p.slot_index, name: p.name }); setMenuOpen(null) }}
                    style={menuItemStyle({ disabled: !hasCurrentSlots || busy })}
                  >
                    <Save size={11} /> Overskriv med nuværende
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleDelete(p.slot_index)}
                    style={menuItemStyle({ danger: true, disabled: busy })}
                  >
                    <Trash2 size={11} /> Slet preset
                  </button>
                </div>
              )}
            </div>
          )
        })}

        {nextSlot >= 0 && (
          <button
            type="button"
            disabled={!hasCurrentSlots}
            onClick={() => setSaveOpen({ slotIndex: nextSlot, name: '' })}
            title={hasCurrentSlots ? 'Gem nuværende lineup som preset' : 'Vælg ryttere først'}
            style={{
              padding: '6px 10px',
              background: hasCurrentSlots ? 'rgba(107,143,113,0.12)' : 'transparent',
              border: `1px dashed ${hasCurrentSlots ? 'rgba(107,143,113,0.5)' : 'rgba(143,171,196,0.25)'}`,
              borderRadius: 2,
              cursor: hasCurrentSlots ? 'pointer' : 'not-allowed',
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: 12, fontWeight: 700,
              color: hasCurrentSlots ? '#8FBF8F' : 'rgba(143,171,196,0.4)',
              letterSpacing: '0.04em',
              display: 'inline-flex', alignItems: 'center', gap: 5,
            }}
          >
            <Plus size={11} /> Gem som preset
          </button>
        )}
      </div>

      {error && (
        <div style={{
          marginTop: 8, fontFamily: "'Barlow', sans-serif", fontSize: 12, color: '#ff6b6b',
        }}>{error}</div>
      )}

      {/* ── Warning efter "Anvend" hvis preset havde ude-ryttere ── */}
      {warning && (
        <div style={{
          marginTop: 8, padding: '8px 10px',
          background: 'rgba(218,165,32,0.10)',
          border: '1px solid rgba(218,165,32,0.35)',
          borderRadius: 2,
          display: 'flex', alignItems: 'flex-start', gap: 8,
        }}>
          <AlertTriangle size={13} color="#FAC775" style={{ flexShrink: 0, marginTop: 1 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, fontWeight: 700,
              color: '#FAC775', letterSpacing: '0.04em', marginBottom: 2,
            }}>
              Anvendt {warning.presetName} — {warning.out.length + warning.missing.length} slot tomme
            </div>
            <div style={{
              fontFamily: "'Barlow', sans-serif", fontSize: 11, lineHeight: 1.45,
              color: 'rgba(255,255,255,0.78)',
            }}>
              {warning.out.length > 0 && (
                <div>Ude af løbet: <strong style={{ color: '#E26D5C' }}>{warning.out.join(', ')}</strong></div>
              )}
              {warning.missing.length > 0 && (
                <div>Ikke på startliste: <strong style={{ color: '#D89090' }}>{warning.missing.join(', ')}</strong></div>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setWarning(null)}
            style={{
              background: 'none', border: 'none', color: '#8FABC4',
              cursor: 'pointer', padding: 0, marginLeft: 4, lineHeight: 0,
            }}
          >
            <X size={13} />
          </button>
        </div>
      )}

      {/* ── Save-modal: navngiv + bekræft ──────────────────── */}
      {saveOpen && (
        <SaveModal
          initialName={saveOpen.name}
          slotIndex={saveOpen.slotIndex}
          onCancel={() => setSaveOpen(null)}
          onConfirm={(name) => handleSave(saveOpen.slotIndex, name)}
          busy={busy}
        />
      )}
    </div>
  )
}

function menuItemStyle(opts: { danger?: boolean; disabled?: boolean }): React.CSSProperties {
  return {
    display: 'flex', alignItems: 'center', gap: 6,
    width: '100%', padding: '6px 10px',
    background: 'transparent', border: 'none',
    fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: 11, fontWeight: 600,
    color: opts.danger ? '#E26D5C' : '#F2EDE4',
    letterSpacing: '0.04em',
    cursor: opts.disabled ? 'not-allowed' : 'pointer',
    opacity: opts.disabled ? 0.4 : 1,
    textAlign: 'left',
  }
}

function SaveModal({
  initialName, slotIndex, onCancel, onConfirm, busy,
}: {
  initialName: string
  slotIndex: number
  onCancel: () => void
  onConfirm: (name: string) => void
  busy: boolean
}) {
  const [name, setName] = useState(initialName)
  const [touched, setTouched] = useState(false)
  const trimmed = name.trim()
  const tooShort = trimmed.length < 1
  const tooLong = trimmed.length > 24
  const invalid = tooShort || tooLong

  const suggestions = initialName ? [] : ['Sprint', 'Bjerg', 'Tempo', 'Hård etape', 'Joker']

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.6)' }}
      onClick={onCancel}
    >
      <div
        style={{
          position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          width: '100%', maxWidth: 360,
          background: '#0F2137', border: '1px solid #2B4F7A', borderRadius: 8,
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{
          padding: '14px 16px', borderBottom: '1px solid #2B4F7A',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{
            fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, fontWeight: 700,
            color: '#F2EDE4', letterSpacing: '0.04em',
          }}>
            {initialName ? `Overskriv "${initialName}"` : `Nyt preset (slot ${slotIndex + 1})`}
          </span>
          <button
            type="button" onClick={onCancel}
            style={{ background: 'none', border: 'none', color: '#8FABC4', fontSize: 18, cursor: 'pointer', padding: 0, lineHeight: 1 }}
          >×</button>
        </div>
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input
            type="text"
            autoFocus
            value={name}
            onChange={(e) => { setName(e.target.value); setTouched(true) }}
            placeholder="Navn (fx Sprint)"
            maxLength={24}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !invalid && !busy) onConfirm(trimmed)
              if (e.key === 'Escape') onCancel()
            }}
            style={{
              width: '100%', padding: '8px 12px',
              border: `1px solid ${touched && invalid ? '#E26D5C' : '#2B4F7A'}`,
              borderRadius: 2,
              fontFamily: "'Barlow', sans-serif", fontSize: 14,
              outline: 'none', background: '#1E3A5F', color: '#F2EDE4',
            }}
          />
          {suggestions.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {suggestions.map((s) => (
                <button
                  key={s} type="button" onClick={() => setName(s)}
                  style={{
                    padding: '4px 8px', background: 'transparent',
                    border: '1px solid rgba(143,171,196,0.3)', borderRadius: 2,
                    fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10, fontWeight: 600,
                    color: '#8FABC4', cursor: 'pointer', letterSpacing: '0.04em',
                  }}
                >{s}</button>
              ))}
            </div>
          )}
          {touched && tooShort && (
            <div style={{ fontFamily: "'Barlow', sans-serif", fontSize: 11, color: '#E26D5C' }}>
              Navn må ikke være tomt
            </div>
          )}
        </div>
        <div style={{
          padding: '10px 16px', borderTop: '1px solid #2B4F7A',
          display: 'flex', justifyContent: 'flex-end', gap: 8,
        }}>
          <button
            type="button" onClick={onCancel}
            style={{
              padding: '8px 14px', background: 'transparent',
              border: '1px solid #2B4F7A', borderRadius: 2,
              fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, fontWeight: 700,
              color: '#8FABC4', cursor: 'pointer', letterSpacing: '0.06em',
            }}
          >Annullér</button>
          <button
            type="button"
            disabled={invalid || busy}
            onClick={() => onConfirm(trimmed)}
            style={{
              padding: '8px 14px', background: '#4A90D9',
              border: 'none', borderRadius: 2,
              fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, fontWeight: 700,
              color: '#fff', letterSpacing: '0.06em',
              cursor: invalid || busy ? 'not-allowed' : 'pointer',
              opacity: invalid || busy ? 0.4 : 1,
              display: 'inline-flex', alignItems: 'center', gap: 5,
            }}
          >
            {busy ? 'Gemmer...' : (<><Check size={12} /> Gem</>)}
          </button>
        </div>
      </div>
    </div>
  )
}
