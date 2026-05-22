'use client'

import { useMemo, useState } from 'react'
import CatBadge from './CatBadge'
import TeamLogo from './TeamLogo'

// Repræsentativ brutto-trup (sample-data — rører ikke den rigtige database)
type PoolRider = { id: string; name: string; team: string; cat: number }
const POOL: PoolRider[] = [
  { id: 'milan', name: 'Milan', team: 'Lidl - Trek', cat: 1 },
  { id: 'consonni', name: 'Consonni', team: 'Lidl - Trek', cat: 4 },
  { id: 'ciccone', name: 'Ciccone', team: 'Lidl - Trek', cat: 2 },
  { id: 'ganna', name: 'Ganna', team: 'Ineos Grenadiers', cat: 1 },
  { id: 'vingegaard', name: 'Vingegaard', team: 'Team Visma | Lease a Bike', cat: 1 },
  { id: 'magnier', name: 'Magnier', team: 'Soudal Quick-Step', cat: 2 },
  { id: 'kopecky', name: 'Kopecký', team: 'Soudal Quick-Step', cat: 5 },
  { id: 'groves', name: 'Groves', team: 'Alpecin - Deceuninck', cat: 2 },
  { id: 'pellizzari', name: 'Pellizzari', team: 'Red Bull - BORA', cat: 3 },
  { id: 'aular', name: 'Aular', team: 'Movistar Team', cat: 3 },
  { id: 'garcia', name: 'García Cortina', team: 'Movistar Team', cat: 4 },
  { id: 'storer', name: 'Storer', team: 'Tudor Pro Cycling', cat: 3 },
  { id: 'pedersen', name: 'Pedersen', team: 'Bahrain - Victorious', cat: 4 },
  { id: 'strong', name: 'Strong', team: 'Israel - Premier Tech', cat: 4 },
  { id: 'leknessund', name: 'Leknessund', team: 'Uno-X Mobility', cat: 5 },
]
const byId = (id: string | null) => POOL.find((r) => r.id === id) ?? null

type SlotKey =
  | 'leader' | 'lieutenant' | 'grimpeur' | 'sprinter'
  | 'domestique_0' | 'domestique_1'
  | 'equipier_0' | 'equipier_1' | 'equipier_2' | 'joker'

const ROLE_DEF: Record<SlotKey, { label: string; cat: number[] | null; hint: string }> = {
  leader: { label: 'Leder', cat: null, hint: 'GC-anker' },
  lieutenant: { label: 'Løjtnant', cat: [2, 3], hint: '×1.8 top-10 · ×2.8 hvis leder DNF' },
  grimpeur: { label: 'Klatrer', cat: [3, 4, 5], hint: 'Bjerg ×1.8' },
  sprinter: { label: 'Spurter', cat: [1, 2, 3], hint: 'Flad ×1.8 + won-how' },
  domestique_0: { label: 'Domestik', cat: [4], hint: '+8 hvis leder top-10' },
  domestique_1: { label: 'Domestik', cat: [4], hint: '+8 hvis leder top-10' },
  equipier_0: { label: 'Equipier', cat: null, hint: '+7 hvis holdet vinder · leadout hvis samme hold som spurter' },
  equipier_1: { label: 'Equipier', cat: null, hint: '+7 hvis holdet vinder · leadout hvis samme hold som spurter' },
  equipier_2: { label: 'Equipier', cat: null, hint: '+7 hvis holdet vinder · leadout hvis samme hold som spurter' },
  joker: { label: 'Joker', cat: null, hint: 'Immun mod minus' },
}
const EQUIPIER_KEYS: SlotKey[] = ['equipier_0', 'equipier_1', 'equipier_2']

type Profile = 'flat' | 'hilly' | 'mountain'
const PROFILE_LABELS: Record<Profile, string> = { flat: 'Flad', hilly: 'Bakket', mountain: 'Bjerg' }
const PROFILE_HINT: Record<Profile, string> = {
  flat: 'Spurt-formation: ingen klatrer — ekstra equipier til leadout-tog.',
  hilly: 'Alsidig: både klatrer og spurter er i spil.',
  mountain: 'Bjerg-formation: ingen spurter — ekstra klatre-domestik til lederen.',
}

// Dynamiske roller: profilen bestemmer hvilke 8 slots der vises.
const PROFILE_SLOTS: Record<Profile, SlotKey[]> = {
  flat: ['leader', 'lieutenant', 'sprinter', 'domestique_0', 'equipier_0', 'equipier_1', 'equipier_2', 'joker'],
  hilly: ['leader', 'lieutenant', 'grimpeur', 'sprinter', 'domestique_0', 'equipier_0', 'equipier_1', 'joker'],
  mountain: ['leader', 'lieutenant', 'grimpeur', 'domestique_0', 'domestique_1', 'equipier_0', 'equipier_1', 'joker'],
}

const INITIAL: Record<SlotKey, string | null> = {
  leader: 'vingegaard', lieutenant: 'ciccone', grimpeur: null, sprinter: 'milan',
  domestique_0: 'pedersen', domestique_1: null,
  equipier_0: 'consonni', equipier_1: 'aular', equipier_2: 'storer', joker: 'magnier',
}

const selectCls =
  'bg-white border-[1.5px] border-warm-border rounded-sm px-2 py-1.5 font-body text-sm text-ink focus:border-forest outline-none cursor-pointer transition-colors duration-200 w-full'

export default function LineupBuilderPreview() {
  const [profile, setProfile] = useState<Profile>('flat')
  const [slots, setSlots] = useState<Record<SlotKey, string | null>>(INITIAL)

  const activeKeys = PROFILE_SLOTS[profile]

  function assign(slot: SlotKey, riderId: string | null) {
    setSlots((s) => {
      const next = { ...s }
      if (riderId) for (const k of Object.keys(next) as SlotKey[]) if (next[k] === riderId) next[k] = null
      next[slot] = riderId
      return next
    })
  }

  // Kun ryttere i de AKTIVE slots tæller med (resten er på bænken)
  const usedIds = useMemo(
    () => new Set(activeKeys.map((k) => slots[k]).filter(Boolean) as string[]),
    [activeKeys, slots]
  )

  const sprinter = activeKeys.includes('sprinter') ? byId(slots.sprinter) : null
  const leadoutEquipiers = useMemo(
    () => (sprinter
      ? EQUIPIER_KEYS.filter((k) => activeKeys.includes(k)).map((k) => byId(slots[k])).filter((r) => r && r.team === sprinter.team)
      : []),
    [sprinter, slots, activeKeys]
  )
  const trainReady = leadoutEquipiers.length > 0

  const teamCounts = useMemo(() => {
    const m = new Map<string, number>()
    for (const id of usedIds) { const r = byId(id); if (r) m.set(r.team, (m.get(r.team) ?? 0) + 1) }
    return m
  }, [usedIds])
  const overCap = [...teamCounts.entries()].filter(([, n]) => n > 3)

  return (
    <div className="space-y-6">
      {/* Profil — skifter selve rolle-sættet */}
      <div className="bg-cream-dark border border-warm-border rounded-sm p-4">
        <p className="label-caps text-warm-taupe mb-2">Etape-profil</p>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(PROFILE_LABELS) as Profile[]).map((p) => (
            <button
              key={p}
              onClick={() => setProfile(p)}
              className={[
                'font-condensed font-semibold uppercase tracking-[0.08em] text-xs px-4 py-2 rounded-sm cursor-pointer transition-colors duration-200',
                profile === p ? 'bg-forest text-cream' : 'bg-transparent border-[1.5px] border-warm-border text-warm-gray hover:text-ink',
              ].join(' ')}
            >{PROFILE_LABELS[p]}</button>
          ))}
        </div>
        <p className="font-body text-xs text-warm-gray mt-2">{PROFILE_HINT[profile]}</p>
      </div>

      {/* Opstilling — dynamiske 8 rolle-slots */}
      <div className="bg-cream-dark border border-warm-border rounded-sm p-4 sm:p-5">
        <div className="flex items-baseline justify-between mb-3">
          <p className="label-caps text-warm-taupe">Opstilling</p>
          <p className="font-condensed text-xs uppercase tracking-[0.08em] text-warm-gray">{usedIds.size} / 8 ryttere</p>
        </div>
        <div className="space-y-2">
          {activeKeys.map((key) => {
            const def = ROLE_DEF[key]
            const rider = byId(slots[key])
            const eligible = POOL.filter((r) => (def.cat === null || def.cat.includes(r.cat)) && (!usedIds.has(r.id) || r.id === slots[key]))
            const isLeadoutEquipier = EQUIPIER_KEYS.includes(key) && rider != null && sprinter != null && rider.team === sprinter.team
            const isTrainSprinter = key === 'sprinter' && trainReady
            return (
              <div key={key} className="bg-white border border-warm-border rounded-sm p-3">
                <div className="grid grid-cols-1 lg:grid-cols-[140px_1fr] gap-2 lg:items-center">
                  <div>
                    <p className="font-condensed font-semibold text-sm uppercase tracking-[0.06em] text-ink leading-none">{def.label}</p>
                    <p className="font-body text-[11px] text-warm-taupe mt-0.5">{def.hint}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {rider ? (
                      <>
                        <TeamLogo url={null} team={rider.team} />
                        <span className="font-body font-semibold text-sm text-ink">{rider.name}</span>
                        <CatBadge cat={rider.cat} />
                        <span className="font-body text-xs text-warm-gray truncate">{rider.team}</span>
                        <button
                          aria-label="Ryd slot" onClick={() => assign(key, null)}
                          className="ml-auto font-condensed text-xs uppercase tracking-[0.06em] text-warm-gray hover:text-vintage-red transition-colors duration-200 cursor-pointer"
                        >Ryd</button>
                      </>
                    ) : (
                      <select aria-label={`Vælg ${def.label}`} className={selectCls} value="" onChange={(e) => assign(key, e.target.value || null)}>
                        <option value="">Vælg rytter…</option>
                        {eligible.map((r) => <option key={r.id} value={r.id}>{r.name} · {r.team} · K{r.cat}</option>)}
                      </select>
                    )}
                  </div>
                </div>
                {isTrainSprinter && (
                  <p className="font-condensed text-[11px] uppercase tracking-[0.08em] text-gold-dark mt-2">
                    Forstærket af {leadoutEquipiers.length} holdkammerat{leadoutEquipiers.length > 1 ? 'er' : ''} — tog ×1.4 hvis top-3
                  </p>
                )}
                {isLeadoutEquipier && (
                  <p className="font-condensed text-[11px] uppercase tracking-[0.08em] text-gold-dark mt-2">
                    Fungerer som leadout for {sprinter?.name} (samme hold)
                  </p>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Status */}
      <div className="bg-forest rounded-sm p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="label-caps text-cream/70 mb-1">Spurt-tog</p>
            <p className={`font-condensed font-semibold uppercase tracking-[0.08em] ${trainReady ? 'text-gold' : 'text-cream/50'}`}>
              {trainReady ? `Klar — ${sprinter?.name} + ${leadoutEquipiers.map((r) => r?.name).join(', ')}` : profile === 'mountain' ? 'Ingen spurter i bjerg-formationen' : 'Ikke aktivt'}
            </p>
          </div>
          <div className="text-right">
            <p className="label-caps text-cream/70 mb-1">Hold-loft</p>
            <p className={`font-condensed font-semibold uppercase tracking-[0.08em] ${overCap.length ? 'text-vintage-red' : 'text-cream/70'}`}>
              {overCap.length ? `For mange: ${overCap.map(([t]) => t).join(', ')}` : 'OK (maks 3 pr. hold)'}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
