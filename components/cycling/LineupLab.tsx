'use client'

import { useMemo, useState } from 'react'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import {
  scoreLineup,
  type Profile,
  type WonHow,
  type Role,
  type SandboxRider,
} from '@/lib/cyclingSandboxScoring'

const ROLE_LABELS: Record<Role, string> = {
  leader: 'Leder',
  lieutenant: 'Løjtnant',
  grimpeur: 'Klatrer',
  sprinter: 'Spurter',
  domestique: 'Domestik',
  leadout: 'Leadout',
  equipier: 'Equipier',
  joker: 'Joker',
}
const ROLES = Object.keys(ROLE_LABELS) as Role[]

const PROFILE_LABELS: Record<Profile, string> = {
  flat: 'Flad', hilly: 'Bakket', mountain: 'Bjerg', mixed: 'Mixed',
}
const WONHOW_LABELS: Record<WonHow, string> = {
  none: '—', bunch: 'Bunkespurt', small_group: 'Lille gruppe', sprint_a_deux: 'Sprint à deux', solo: 'Solo',
}

let _id = 0
const nextId = () => `r${_id++}`
const mk = (role: Role, category: number, position: number | null): SandboxRider =>
  ({ id: nextId(), role, category, position, dnf: false })

const PRESETS: Record<string, { label: string; profile: Profile; wonHow: WonHow; riders: SandboxRider[] }> = {
  train: {
    label: 'Tog: 1 spurter + 2 leadout',
    profile: 'flat', wonHow: 'bunch',
    riders: [mk('sprinter', 1, 1), mk('leadout', 3, 30), mk('leadout', 4, 33)],
  },
  spread: {
    label: 'Spredt: 3 finishers',
    profile: 'flat', wonHow: 'bunch',
    riders: [mk('sprinter', 1, 2), mk('lieutenant', 1, 5), mk('joker', 1, 9)],
  },
  gc: {
    label: 'Bjerg: leder + løjtnant + domestik',
    profile: 'mountain', wonHow: 'solo',
    riders: [mk('leader', 1, 3), mk('lieutenant', 2, 7), mk('domestique', 3, 22), mk('grimpeur', 2, 1)],
  },
}

const selectCls =
  'bg-white border-[1.5px] border-warm-border rounded-sm px-3 py-2 font-body text-sm text-ink focus:border-forest outline-none cursor-pointer transition-colors duration-200'

export default function LineupLab() {
  const [profile, setProfile] = useState<Profile>('flat')
  const [wonHow, setWonHow] = useState<WonHow>('bunch')
  const [useTrain, setUseTrain] = useState(true)
  const [riders, setRiders] = useState<SandboxRider[]>(() =>
    PRESETS.train.riders.map((r) => ({ ...r, id: nextId() }))
  )

  const scored = useMemo(
    () => scoreLineup(riders, profile, wonHow, useTrain),
    [riders, profile, wonHow, useTrain]
  )

  function update(id: string, patch: Partial<SandboxRider>) {
    setRiders((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }
  function remove(id: string) {
    setRiders((rs) => rs.filter((r) => r.id !== id))
  }
  function add() {
    setRiders((rs) => [...rs, mk('domestique', 3, 20)])
  }
  function loadPreset(key: keyof typeof PRESETS) {
    const p = PRESETS[key]
    setProfile(p.profile)
    setWonHow(p.wonHow)
    setRiders(p.riders.map((r) => ({ ...r, id: nextId() })))
  }

  return (
    <div className="space-y-6">
      {/* Stage-kontroller */}
      <Card padding="md">
        <p className="label-caps text-warm-taupe mb-3">Etape-scenarie</p>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="font-condensed font-semibold text-xs uppercase tracking-[0.08em] text-warm-gray">Profil</span>
            <select aria-label="Profil" className={selectCls} value={profile} onChange={(e) => setProfile(e.target.value as Profile)}>
              {Object.entries(PROFILE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="font-condensed font-semibold text-xs uppercase tracking-[0.08em] text-warm-gray">Won how</span>
            <select aria-label="Won how" className={selectCls} value={wonHow} onChange={(e) => setWonHow(e.target.value as WonHow)}>
              {Object.entries(WONHOW_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
          <label className="flex items-end gap-2 cursor-pointer">
            <input type="checkbox" className="w-4 h-4 accent-forest cursor-pointer" checked={useTrain} onChange={(e) => setUseTrain(e.target.checked)} />
            <span className="font-condensed font-semibold text-xs uppercase tracking-[0.08em] text-ink pb-2.5">Eksperimentel tog-synergi</span>
          </label>
        </div>

        <div className="flex flex-wrap gap-2 mt-4">
          {(Object.keys(PRESETS) as (keyof typeof PRESETS)[]).map((k) => (
            <Button key={k} variant="secondary" size="sm" onClick={() => loadPreset(k)}>{PRESETS[k].label}</Button>
          ))}
        </div>
      </Card>

      {/* Opstilling */}
      <Card padding="md">
        <div className="flex items-center justify-between mb-1">
          <p className="label-caps text-warm-taupe">Opstilling</p>
          <Button variant="ghost" size="sm" onClick={add}>+ Tilføj rytter</Button>
        </div>
        <p className="font-body text-xs text-warm-gray mb-3">
          Hver række: rolle · rytterens kategori · <span className="font-semibold text-ink">slutplacering i etapen</span> (1 = vinder).
          Placeringen driver basispointene (1.=50, 2-3=30, 4-5=20, 6-10=10, 11-20=5).
        </p>

        <div className="hidden lg:grid grid-cols-[1.3fr_0.9fr_0.9fr_auto_auto] gap-2 px-3 pb-1">
          <span className="font-condensed text-[11px] uppercase tracking-[0.08em] text-warm-taupe">Rolle</span>
          <span className="font-condensed text-[11px] uppercase tracking-[0.08em] text-warm-taupe">Kategori</span>
          <span className="font-condensed text-[11px] uppercase tracking-[0.08em] text-warm-taupe">Slutplacering</span>
          <span aria-hidden="true" /><span aria-hidden="true" />
        </div>

        <div className="space-y-2">
          {scored.rows.map((r) => (
            <div key={r.id} className="bg-white border border-warm-border rounded-sm p-3">
              <div className="grid grid-cols-2 lg:grid-cols-[1.3fr_0.9fr_0.9fr_auto_auto] gap-2 items-center">
                <select aria-label="Rolle" className={selectCls} value={r.role} onChange={(e) => update(r.id, { role: e.target.value as Role })}>
                  {ROLES.map((role) => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}
                </select>
                <select aria-label="Kategori" className={selectCls} value={r.category} onChange={(e) => update(r.id, { category: Number(e.target.value) })}>
                  {[1, 2, 3, 4, 5].map((c) => <option key={c} value={c}>Kat {c}</option>)}
                </select>
                <input
                  aria-label="Slutplacering (1 = vinder)" type="number" min={1} placeholder="Plac."
                  className={selectCls}
                  value={r.position ?? ''}
                  onChange={(e) => update(r.id, { position: e.target.value === '' ? null : Number(e.target.value) })}
                />
                <label className="flex items-center gap-1.5 cursor-pointer justify-self-start">
                  <input type="checkbox" className="w-4 h-4 accent-vintage-red cursor-pointer" checked={r.dnf} onChange={(e) => update(r.id, { dnf: e.target.checked })} />
                  <span className="font-condensed text-xs uppercase tracking-[0.06em] text-warm-gray">DNF</span>
                </label>
                <button
                  aria-label="Fjern rytter" onClick={() => remove(r.id)}
                  className="font-condensed text-xs uppercase tracking-[0.06em] text-warm-gray hover:text-vintage-red transition-colors duration-200 cursor-pointer justify-self-end px-2"
                >Fjern</button>
              </div>

              <div className="flex items-center justify-between mt-2 pt-2 border-t border-warm-border/60">
                <span className="font-body text-xs text-warm-gray">
                  {r.bd.notes.length ? r.bd.notes.join(' · ') : `base ${r.bd.base} × ${r.bd.roleMul}`}
                </span>
                <span className={`stat-number text-base ${r.bd.total < 0 ? 'text-vintage-red' : 'text-ink'}`}>
                  {r.bd.total} pt
                </span>
              </div>
            </div>
          ))}
          {scored.rows.length === 0 && (
            <p className="font-body text-sm text-warm-gray py-4 text-center">Ingen ryttere — tilføj én eller vælg et preset.</p>
          )}
        </div>
      </Card>

      {/* Total + synergi */}
      <div className="bg-forest rounded-sm p-5 sm:p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="label-caps text-cream/70 mb-1">Holdtotal</p>
            <p className="stat-number text-cream text-3xl">{scored.total} pt</p>
          </div>
          <div className="text-right">
            {scored.trainActive ? (
              <p className="font-condensed font-semibold text-sm uppercase tracking-[0.08em] text-gold">
                Spurt-tog aktivt · ×{scored.trainMul.toFixed(1)}
              </p>
            ) : (
              <p className="font-condensed text-sm uppercase tracking-[0.08em] text-cream/50">
                Intet tog aktivt
              </p>
            )}
            <p className="font-body text-xs text-cream/60 mt-1 max-w-[240px]">
              {useTrain
                ? 'Toget kræver en spurter i top-3 + mindst 1 leadout. Sæt spurteren udenfor top-3 for at se gulvet.'
                : 'Tog-synergi er slået fra — sammenlign med den til.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
