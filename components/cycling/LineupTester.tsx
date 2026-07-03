'use client'

import { useMemo, useState } from 'react'
import type { CyclingRoleKey } from '@/types/cycling'
import { slotsForProfile } from '@/lib/cyclingRoles'
import { CAT_COLORS } from '@/lib/cyclingUtils'
import CatBadge from './CatBadge'
import TeamLogo from './TeamLogo'
import type { Rider } from './SquadBuilder'

// ── Rolle-metadata (label + kategori-regel) ────────────────────────────────
// Samme regler som det rigtige lineup (se LineupBuilder ROLES): kategori-
// bundne roller kræver en rytter i et bestemt kategori-interval.
const ROLE_META: Record<CyclingRoleKey, { label: string; catRule: number[] | null }> = {
  leader: { label: 'Leader', catRule: null },
  lieutenant: { label: 'Lieutenant', catRule: [2, 3] },
  grimpeur: { label: 'Klatrer', catRule: [3, 4, 5] },
  sprinter: { label: 'Sprinter', catRule: [1, 2, 3] },
  domestique: { label: 'Domestique', catRule: [4] },
  equipier_0: { label: 'Équipier', catRule: null },
  equipier_1: { label: 'Équipier', catRule: null },
  equipier_2: { label: 'Équipier', catRule: null },
  equipier_3: { label: 'Équipier', catRule: null },
  equipier_4: { label: 'Équipier', catRule: null },
  equipier_5: { label: 'Équipier', catRule: null },
  joker: { label: 'Joker', catRule: null },
}

// Arketyperne vi tester imod (terræn der driver scoring-bonussen).
const ARCHETYPES: { profile: string; label: string; icon: string; hint: string }[] = [
  { profile: 'flat', label: 'Flad', icon: '🏁', hint: 'Sprinter ×1.8 — spurt-tog' },
  { profile: 'hilly', label: 'Kuperet', icon: '⛰️', hint: 'Klatrer + sprinter ×1.2' },
  { profile: 'mountain', label: 'Bjerg', icon: '🏔️', hint: 'Klatrer ×1.8' },
]

const MIN_RIDERS = 8

// ── Bipartit-matching: kan de kategori-bundne roller alle besættes? ─────────
// Kuhn's algoritme over de restricted slots (≤4) mod truppen. Returnerer en
// rider-id pr. restricted slot (null hvis ingen ledig passende rytter).
function matchRestricted(
  restricted: CyclingRoleKey[],
  riders: Rider[],
): Record<CyclingRoleKey, string | null> {
  const adj: string[][] = restricted.map((key) => {
    const rule = ROLE_META[key].catRule!
    return riders.filter((r) => rule.includes(r.category)).map((r) => r.id)
  })
  const slotRider: (string | null)[] = new Array(restricted.length).fill(null)
  const riderSlot = new Map<string, number>()

  function augment(s: number, seen: Set<string>): boolean {
    for (const rid of adj[s]) {
      if (seen.has(rid)) continue
      seen.add(rid)
      const cur = riderSlot.get(rid)
      if (cur === undefined || augment(cur, seen)) {
        slotRider[s] = rid
        riderSlot.set(rid, s)
        return true
      }
    }
    return false
  }

  for (let s = 0; s < restricted.length; s++) augment(s, new Set())

  const out = {} as Record<CyclingRoleKey, string | null>
  restricted.forEach((key, i) => { out[key] = slotRider[i] })
  return out
}

/** Bedste opstilling truppen kan stille for en profil + hvilke roller der mangler. */
function bestLineup(profile: string, riders: Rider[]): {
  assignment: Record<CyclingRoleKey, string | null>
  deficits: CyclingRoleKey[]
} {
  const slotKeys = slotsForProfile(profile)
  const restricted = slotKeys.filter((k) => ROLE_META[k].catRule !== null)
  const anySlots = slotKeys.filter((k) => ROLE_META[k].catRule === null)

  const matched = matchRestricted(restricted, riders)
  const assignment = {} as Record<CyclingRoleKey, string | null>
  const used = new Set<string>()
  const deficits: CyclingRoleKey[] = []

  for (const key of restricted) {
    const rid = matched[key]
    assignment[key] = rid
    if (rid) used.add(rid)
    else deficits.push(key)
  }

  // Fyld frie slots med resterende ryttere (leader/equipier/joker i trup-orden).
  const leftovers = riders.filter((r) => !used.has(r.id))
  let li = 0
  for (const key of anySlots) {
    const r = leftovers[li++]
    assignment[key] = r ? r.id : null
  }

  return { assignment, deficits }
}

// ── Komponent ────────────────────────────────────────────────────────────
export default function LineupTester({ squad }: { squad: Rider[] }) {
  const [open, setOpen] = useState(false)
  const [activeProfile, setActiveProfile] = useState('mountain')
  // Manuel sandbox pr. profil (valgfri — beredskabs-tjekket kører uafhængigt).
  const [manual, setManual] = useState<Record<string, Record<CyclingRoleKey, string | null>>>({})
  const [pickerSlot, setPickerSlot] = useState<CyclingRoleKey | null>(null)

  const riderMap = useMemo(() => {
    const m = new Map<string, Rider>()
    for (const r of squad) m.set(r.id, r)
    return m
  }, [squad])

  const enough = squad.length >= MIN_RIDERS

  // Beredskab pr. arketype (rent afledt af trup — uafhængigt af manuel sandbox).
  const readiness = useMemo(() => {
    return ARCHETYPES.map((a) => {
      const { deficits } = bestLineup(a.profile, squad)
      const slotKeys = slotsForProfile(a.profile)
      const ready = deficits.length === 0 && squad.length >= slotKeys.length
      return { ...a, ready, deficits, slots: slotKeys.length }
    })
  }, [squad])

  const slotKeys = useMemo(() => slotsForProfile(activeProfile), [activeProfile])

  // Aktiv opstilling: manuel hvis sat, ellers tom (bruger trykker "Fyld bedste").
  const activeSlots = manual[activeProfile] ?? ({} as Record<CyclingRoleKey, string | null>)
  const usedInActive = useMemo(
    () => new Set(Object.values(activeSlots).filter((v): v is string => !!v)),
    [activeSlots],
  )

  function setSlot(key: CyclingRoleKey, riderId: string | null) {
    setManual((prev) => {
      const cur = { ...(prev[activeProfile] ?? {}) } as Record<CyclingRoleKey, string | null>
      // Fjern rytter fra ethvert andet slot (ingen dubletter).
      if (riderId) {
        for (const k of Object.keys(cur) as CyclingRoleKey[]) {
          if (cur[k] === riderId) cur[k] = null
        }
      }
      cur[key] = riderId
      return { ...prev, [activeProfile]: cur }
    })
    setPickerSlot(null)
  }

  function fillBest() {
    const { assignment } = bestLineup(activeProfile, squad)
    setManual((prev) => ({ ...prev, [activeProfile]: assignment }))
    setPickerSlot(null)
  }

  function clear() {
    setManual((prev) => ({ ...prev, [activeProfile]: {} as Record<CyclingRoleKey, string | null> }))
    setPickerSlot(null)
  }

  const filledCount = slotKeys.filter((k) => activeSlots[k]).length

  // Kort glanceable-summary til header (selv når panelet er lukket).
  const summary = readiness
    .map((r) => `${r.label} ${r.ready ? '✓' : '⚠'}`)
    .join('  ·  ')

  const font = "'Barlow Condensed', sans-serif"

  return (
    <div
      style={{
        marginTop: 16,
        border: '1px solid var(--color-warm-border)',
        borderRadius: 2,
        background: 'var(--color-cream)',
        overflow: 'hidden',
      }}
    >
      {/* ── Header / toggle ─────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, width: '100%',
          padding: '10px 14px', background: 'transparent', border: 'none',
          cursor: 'pointer', textAlign: 'left',
        }}
      >
        <span style={{ fontSize: 10, color: 'var(--color-muted)' }}>{open ? '▾' : '▸'}</span>
        <span
          style={{
            fontFamily: font, fontSize: 11, fontWeight: 700,
            letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--color-ink)',
          }}
        >
          Test opstilling
        </span>
        <span
          style={{
            marginLeft: 'auto', fontFamily: font, fontSize: 11, fontWeight: 600,
            color: 'var(--color-warm-gray)', whiteSpace: 'nowrap',
            overflow: 'hidden', textOverflow: 'ellipsis',
          }}
        >
          {enough ? summary : `Vælg mindst ${MIN_RIDERS} ryttere`}
        </span>
      </button>

      {open && (
        <div style={{ padding: '0 14px 14px' }}>
          {/* ── Beredskabs-tjek pr. arketype ─────────────────────── */}
          <div
            style={{
              fontFamily: font, fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
              textTransform: 'uppercase', color: 'var(--color-muted)', margin: '4px 0 8px',
            }}
          >
            Kan din trup stille et lineup?
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 14 }}>
            {readiness.map((r) => {
              const color = !enough
                ? 'var(--color-muted)'
                : r.ready ? 'var(--color-success)' : 'var(--color-gold-dark)'
              const missing = r.deficits.map((k) => ROLE_META[k].label)
              return (
                <div
                  key={r.profile}
                  style={{
                    padding: '8px 9px', borderRadius: 2,
                    border: `1px solid ${enough ? color : 'var(--color-warm-border)'}`,
                    background: enough
                      ? `color-mix(in srgb, ${color} 8%, transparent)`
                      : 'transparent',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 12 }}>{r.icon}</span>
                    <span style={{ fontFamily: font, fontSize: 12, fontWeight: 700, color: 'var(--color-ink)' }}>
                      {r.label}
                    </span>
                    <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 700, color }}>
                      {!enough ? '–' : r.ready ? '✓' : '⚠'}
                    </span>
                  </div>
                  <div
                    style={{
                      fontFamily: font, fontSize: 10, lineHeight: 1.3, marginTop: 3,
                      color: enough && !r.ready ? 'var(--color-gold-dark)' : 'var(--color-muted)',
                    }}
                  >
                    {!enough
                      ? r.hint
                      : r.ready
                        ? 'Fuldt lineup muligt'
                        : `Mangler: ${missing.join(', ')}`}
                  </div>
                </div>
              )
            })}
          </div>

          {/* ── Profil-vælger (prøv en konkret opstilling) ───────── */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 8, flexWrap: 'wrap' }}>
            {ARCHETYPES.map((a) => {
              const isActive = a.profile === activeProfile
              return (
                <button
                  key={a.profile}
                  type="button"
                  onClick={() => { setActiveProfile(a.profile); setPickerSlot(null) }}
                  style={{
                    padding: '4px 10px', borderRadius: 999,
                    border: `1px solid ${isActive ? 'var(--color-forest)' : 'var(--color-warm-border)'}`,
                    background: isActive ? 'var(--color-forest)' : 'transparent',
                    color: isActive ? 'var(--color-cream)' : 'var(--color-warm-gray)',
                    fontFamily: font, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  {a.icon} {a.label}
                </button>
              )
            })}
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
              <button
                type="button"
                onClick={fillBest}
                disabled={!enough}
                style={{
                  padding: '4px 10px', borderRadius: 2, border: 'none',
                  background: enough ? 'var(--color-forest)' : 'var(--color-warm-border)',
                  color: 'var(--color-cream)', fontFamily: font, fontSize: 11, fontWeight: 700,
                  cursor: enough ? 'pointer' : 'not-allowed', opacity: enough ? 1 : 0.6,
                }}
              >
                Fyld bedste
              </button>
              {filledCount > 0 && (
                <button
                  type="button"
                  onClick={clear}
                  style={{
                    padding: '4px 10px', borderRadius: 2,
                    border: '1px solid var(--color-warm-border)', background: 'transparent',
                    color: 'var(--color-warm-gray)', fontFamily: font, fontSize: 11, fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Ryd
                </button>
              )}
            </div>
          </div>

          {/* ── Slots for aktiv profil ───────────────────────────── */}
          <div style={{ border: '1px solid var(--color-warm-border)', borderRadius: 2, background: '#fff' }}>
            {slotKeys.map((key, idx) => {
              const meta = ROLE_META[key]
              const rider = activeSlots[key] ? riderMap.get(activeSlots[key]!) ?? null : null
              const isPicking = pickerSlot === key
              const ruleLabel = meta.catRule ? `Kat ${meta.catRule.join('/')}` : 'Alle kat.'
              // Ledige ryttere til dette slot: kategori-regel + ikke allerede brugt.
              const candidates = squad.filter(
                (r) =>
                  (!meta.catRule || meta.catRule.includes(r.category)) &&
                  (!usedInActive.has(r.id) || r.id === activeSlots[key]),
              )
              return (
                <div
                  key={key}
                  style={{ borderBottom: idx < slotKeys.length - 1 ? '1px solid var(--color-cream-dark)' : 'none' }}
                >
                  <button
                    type="button"
                    onClick={() => setPickerSlot(isPicking ? null : key)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                      padding: '8px 10px', background: isPicking ? 'var(--color-cream)' : 'transparent',
                      border: 'none', cursor: 'pointer', textAlign: 'left',
                    }}
                  >
                    <div style={{ width: 78, flexShrink: 0 }}>
                      <div style={{ fontFamily: font, fontSize: 12, fontWeight: 700, color: 'var(--color-ink)', lineHeight: 1.1 }}>
                        {meta.label}
                      </div>
                      <div style={{ fontFamily: font, fontSize: 9, color: 'var(--color-muted)' }}>{ruleLabel}</div>
                    </div>
                    {rider ? (
                      <>
                        <TeamLogo url={rider.team_logo_url} team={rider.team_name} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              fontFamily: font, fontSize: 13, fontWeight: 600, color: 'var(--color-ink)',
                              lineHeight: 1.15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                            }}
                          >
                            {rider.last_name}
                            <span style={{ fontWeight: 400, color: 'var(--color-warm-gray)' }}> {rider.first_name}</span>
                          </div>
                          <div style={{ fontFamily: font, fontSize: 10, color: 'var(--color-muted)', lineHeight: 1.15 }}>
                            {rider.team_name}
                          </div>
                        </div>
                        <CatBadge cat={rider.category} />
                      </>
                    ) : (
                      <div
                        style={{
                          flex: 1, fontFamily: font, fontSize: 12, fontStyle: 'italic',
                          color: candidates.length === 0 ? 'var(--color-gold-dark)' : 'var(--color-muted)',
                        }}
                      >
                        {candidates.length === 0 ? `Ingen ${ruleLabel.toLowerCase()}-rytter i truppen` : 'Vælg rytter …'}
                      </div>
                    )}
                    <span style={{ fontSize: 11, color: 'var(--color-muted)' }}>{isPicking ? '▾' : '▸'}</span>
                  </button>

                  {/* ── Inline picker ─────────────────────────────── */}
                  {isPicking && (
                    <div style={{ maxHeight: 180, overflowY: 'auto', borderTop: '1px solid var(--color-cream-dark)' }}>
                      {rider && (
                        <button
                          type="button"
                          onClick={() => setSlot(key, null)}
                          style={{
                            display: 'block', width: '100%', padding: '6px 10px', background: 'transparent',
                            border: 'none', borderBottom: '1px solid var(--color-cream-dark)', cursor: 'pointer',
                            textAlign: 'left', fontFamily: font, fontSize: 11, fontWeight: 600,
                            color: 'var(--color-vintage-red)',
                          }}
                        >
                          Fjern fra slot
                        </button>
                      )}
                      {candidates.length === 0 ? (
                        <div style={{ padding: '10px', fontFamily: font, fontSize: 12, color: 'var(--color-muted)' }}>
                          Ingen passende ryttere i truppen
                        </div>
                      ) : (
                        candidates.map((r) => (
                          <button
                            key={r.id}
                            type="button"
                            onClick={() => setSlot(key, r.id)}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                              padding: '6px 10px', background: 'transparent', border: 'none',
                              cursor: 'pointer', textAlign: 'left',
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-cream)' }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                          >
                            <TeamLogo url={r.team_logo_url} team={r.team_name} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div
                                style={{
                                  fontFamily: font, fontSize: 12, fontWeight: 600, color: 'var(--color-ink)',
                                  lineHeight: 1.15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                                }}
                              >
                                {r.last_name}
                                <span style={{ fontWeight: 400, color: 'var(--color-warm-gray)' }}> {r.first_name}</span>
                              </div>
                              <div style={{ fontFamily: font, fontSize: 9, color: 'var(--color-muted)', lineHeight: 1.15 }}>
                                {r.team_name}
                              </div>
                            </div>
                            <CatBadge cat={r.category} />
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <div
            style={{
              marginTop: 8, fontFamily: font, fontSize: 10, color: 'var(--color-muted)', lineHeight: 1.4,
            }}
          >
            Kun en test — gemmes ikke. Rolle-slots og kategori-regler er de samme som når du sætter et rigtigt lineup.
            {filledCount > 0 && <> · {filledCount}/{slotKeys.length} pladser fyldt.</>}
          </div>
        </div>
      )}
    </div>
  )
}
