'use client'

import { useState, useEffect, useRef } from 'react'
import { formatDate } from '@/lib/dateUtils'

type Season = {
  id: number
  tournament_id: number
  name: string
  bold_phase_ids: string | null
  is_active: boolean
  start_date: string | null
  end_date: string | null
}

type Tournament = {
  id: number
  name: string
  seasons: Season[]
}

type ModalState =
  | { mode: 'edit'; season: Season }
  | { mode: 'create'; tournament_id: number; tournament_name: string }
  | null

type Props = {
}


function Modal({
  state,
  onClose,
  onSaved,
  }: {
  state: ModalState
  onClose: () => void
  onSaved: (season: Season) => void
}) {
  const [boldPhaseIds, setBoldPhaseIds] = useState('')
  const [isActive, setIsActive] = useState(false)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const firstInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!state) return
    if (state.mode === 'edit') {
      setBoldPhaseIds(state.season.bold_phase_ids ?? '')
      setIsActive(state.season.is_active)
      setStartDate(state.season.start_date?.slice(0, 10) ?? '')
      setEndDate(state.season.end_date?.slice(0, 10) ?? '')
      setName(state.season.name)
    } else {
      setBoldPhaseIds('')
      setIsActive(true)
      setStartDate('')
      setEndDate('')
      setName('')
    }
    setError(null)
    setTimeout(() => firstInputRef.current?.focus(), 50)
  }, [state])

  if (!state) return null

  const title = state.mode === 'edit'
    ? `Rediger sæson — ${state.season.name}`
    : `Ny sæson — ${state.tournament_name}`

  async function handleSave() {
    setSaving(true)
    setError(null)
    const headers = {
      'Content-Type': 'application/json',
          }

    try {
      let res: Response
      if (state!.mode === 'edit') {
        res = await fetch(`/api/admin/seasons/${state!.season.id}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({
            bold_phase_ids: boldPhaseIds.trim() || null,
            is_active: isActive,
            start_date: startDate || null,
            end_date: endDate || null,
          }),
        })
      } else {
        res = await fetch('/api/admin/seasons', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            tournament_id: state!.tournament_id,
            name: name.trim(),
            bold_phase_ids: boldPhaseIds.trim() || null,
            is_active: isActive,
            start_date: startDate || null,
            end_date: endDate || null,
          }),
        })
      }
      const data = await res.json()
      if (!res.ok || !data.ok) {
        setError(data.error ?? 'Ukendt fejl')
      } else {
        onSaved(data.season)
      }
    } catch {
      setError('Netværksfejl')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="bg-cream w-full max-w-md border border-warm-border shadow-xl"
        style={{ borderRadius: '2px' }}
      >
        {/* Header */}
        <div className="bg-forest px-5 py-3 flex items-center justify-between">
          <h3 className="font-condensed font-bold text-cream uppercase tracking-wide text-sm">
            {title}
          </h3>
          <button
            onClick={onClose}
            className="text-cream/60 hover:text-cream font-body text-lg leading-none"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          {state.mode === 'create' && (
            <div>
              <label className="block font-condensed text-[11px] font-bold uppercase tracking-wide text-warm-gray mb-1">
                Navn
              </label>
              <input
                ref={firstInputRef}
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="fx 2024/25"
                className="w-full border border-warm-border bg-white text-ink px-3 py-2 text-sm font-body focus:outline-none focus:border-forest"
                style={{ borderRadius: '2px' }}
              />
            </div>
          )}

          <div>
            <label className="block font-condensed text-[11px] font-bold uppercase tracking-wide text-warm-gray mb-1">
              Bold phase_ids
            </label>
            <input
              ref={state.mode === 'edit' ? firstInputRef : undefined}
              type="text"
              value={boldPhaseIds}
              onChange={(e) => setBoldPhaseIds(e.target.value)}
              placeholder="fx 23844 eller 22620,22621,..."
              className="w-full border border-warm-border bg-white text-ink px-3 py-2 text-sm font-body focus:outline-none focus:border-forest"
              style={{ borderRadius: '2px' }}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-condensed text-[11px] font-bold uppercase tracking-wide text-warm-gray mb-1">
                Startdato
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full border border-warm-border bg-white text-ink px-3 py-2 text-sm font-body focus:outline-none focus:border-forest"
                style={{ borderRadius: '2px' }}
              />
            </div>
            <div>
              <label className="block font-condensed text-[11px] font-bold uppercase tracking-wide text-warm-gray mb-1">
                Slutdato
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full border border-warm-border bg-white text-ink px-3 py-2 text-sm font-body focus:outline-none focus:border-forest"
                style={{ borderRadius: '2px' }}
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="is_active"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="w-4 h-4 accent-forest"
            />
            <label htmlFor="is_active" className="font-condensed text-sm text-ink font-semibold cursor-pointer">
              Aktiv sæson
            </label>
          </div>

          {error && (
            <p className="font-body text-sm text-vintage-red">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-warm-border flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="font-condensed text-xs uppercase tracking-wide text-warm-gray hover:text-ink px-4 py-2"
          >
            Annuller
          </button>
          <button
            onClick={handleSave}
            disabled={saving || (state.mode === 'create' && !name.trim())}
            className="font-condensed text-xs uppercase tracking-widest bg-forest text-cream px-5 py-2 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ borderRadius: '2px' }}
          >
            {saving ? 'Gemmer...' : 'Gem'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function AdminSeasonsTab() {
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<ModalState>(null)

  useEffect(() => {
    fetch('/api/admin/seasons', {
          })
      .then((r) => r.json())
      .then((d) => setTournaments(d.tournaments ?? []))
      .catch(() => setTournaments([]))
      .finally(() => setLoading(false))
  }, [])

  function handleSaved(saved: Season) {
    setTournaments((prev) =>
      prev.map((t) => {
        if (t.id !== saved.tournament_id) return t
        const exists = t.seasons.some((s) => s.id === saved.id)
        return {
          ...t,
          seasons: exists
            ? t.seasons.map((s) => (s.id === saved.id ? saved : s))
            : [saved, ...t.seasons],
        }
      })
    )
    setModal(null)
  }

  if (loading) {
    return (
      <div className="border border-warm-border bg-cream p-12 text-center font-body text-warm-gray" style={{ borderRadius: '2px' }}>
        Henter sæsoner...
      </div>
    )
  }

  return (
    <>
      <Modal
        state={modal}
        onClose={() => setModal(null)}
        onSaved={handleSaved}
      />

      <div className="space-y-6">
        {tournaments.length === 0 && (
          <div className="border border-warm-border bg-cream p-12 text-center font-body text-warm-gray" style={{ borderRadius: '2px' }}>
            Ingen turneringer fundet
          </div>
        )}

        {tournaments.map((tournament) => (
          <div key={tournament.id} className="border border-warm-border overflow-hidden" style={{ borderRadius: '2px' }}>
            {/* Tournament header */}
            <div className="bg-forest px-4 sm:px-5 py-3 flex items-center justify-between gap-3">
              <h3 className="font-condensed font-bold text-cream uppercase tracking-wide text-sm sm:text-base min-w-0 truncate">
                {tournament.name}
              </h3>
              <button
                onClick={() => setModal({ mode: 'create', tournament_id: tournament.id, tournament_name: tournament.name })}
                className="font-condensed text-[11px] uppercase tracking-widest text-cream/70 active:text-cream border border-cream/20 px-3 py-1.5 sm:py-1 transition-colors shrink-0"
                style={{ borderRadius: '2px' }}
              >
                + Ny sæson
              </button>
            </div>

            {/* Season rows */}
            {tournament.seasons.length === 0 ? (
              <div className="px-5 py-6 text-center font-body text-warm-gray text-sm bg-cream">
                Ingen sæsoner
              </div>
            ) : (
              <>
              {/* Mobile season cards */}
              <ul className="md:hidden divide-y divide-warm-border bg-cream">
                {tournament.seasons.map((season) => (
                  <li key={season.id} className="p-4">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="min-w-0">
                        <p className="font-condensed font-semibold text-ink truncate">{season.name}</p>
                        <p className="font-body text-[11px] text-warm-taupe mt-0.5">
                          {season.bold_phase_ids ? `phase_ids ${season.bold_phase_ids}` : <span className="text-vintage-red/70">phase_ids mangler</span>}
                        </p>
                        <p className="font-body text-[11px] text-warm-gray mt-0.5">
                          {season.start_date || season.end_date
                            ? `${formatDate(season.start_date)} – ${formatDate(season.end_date)}`
                            : 'Ingen periode angivet'}
                        </p>
                      </div>
                      <span
                        className={`font-condensed text-[10px] uppercase tracking-wide border px-1.5 py-0.5 shrink-0 ${
                          season.is_active
                            ? 'bg-forest/10 text-forest border-forest/30'
                            : 'bg-cream-dark text-warm-gray border-warm-border'
                        }`}
                        style={{ borderRadius: '2px' }}
                      >
                        {season.is_active ? 'Aktiv' : 'Inaktiv'}
                      </span>
                    </div>
                    <button
                      onClick={() => setModal({ mode: 'edit', season })}
                      className="w-full font-condensed text-[12px] uppercase tracking-wide text-forest border border-forest/30 active:bg-forest/5 py-2.5 transition-colors"
                      style={{ borderRadius: '2px' }}
                    >
                      Rediger
                    </button>
                  </li>
                ))}
              </ul>

              <table className="hidden md:table w-full">
                <thead>
                  <tr className="bg-cream-dark border-b border-warm-border">
                    <th className="text-left px-5 py-2.5 font-condensed text-[10px] font-bold uppercase tracking-wider text-warm-gray">Sæson</th>
                    <th className="text-left px-4 py-2.5 font-condensed text-[10px] font-bold uppercase tracking-wider text-warm-gray">Bold phase_ids</th>
                    <th className="text-left px-4 py-2.5 font-condensed text-[10px] font-bold uppercase tracking-wider text-warm-gray">Status</th>
                    <th className="text-left px-4 py-2.5 font-condensed text-[10px] font-bold uppercase tracking-wider text-warm-gray">Periode</th>
                    <th className="text-right px-5 py-2.5 font-condensed text-[10px] font-bold uppercase tracking-wider text-warm-gray">Handling</th>
                  </tr>
                </thead>
                <tbody>
                  {tournament.seasons.map((season) => (
                    <tr key={season.id} className="border-b border-warm-border last:border-0 bg-cream hover:bg-cream-dark/30 transition-colors">
                      <td className="px-5 py-3 font-condensed font-semibold text-sm text-ink">
                        {season.name}
                      </td>
                      <td className="px-4 py-3 font-condensed text-sm">
                        {season.bold_phase_ids ? (
                          <span className="text-ink">{season.bold_phase_ids}</span>
                        ) : (
                          <span className="text-vintage-red/70">mangler</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`font-condensed text-xs uppercase tracking-wide border px-2 py-0.5 ${
                            season.is_active
                              ? 'bg-forest/10 text-forest border-forest/30'
                              : 'bg-cream-dark text-warm-gray border-warm-border'
                          }`}
                          style={{ borderRadius: '2px' }}
                        >
                          {season.is_active ? 'Aktiv' : 'Inaktiv'}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-body text-[12px] text-warm-gray">
                        {season.start_date || season.end_date
                          ? `${formatDate(season.start_date)} – ${formatDate(season.end_date)}`
                          : '—'}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <button
                          onClick={() => setModal({ mode: 'edit', season })}
                          className="font-condensed text-[11px] uppercase tracking-wide text-forest hover:text-forest/70 border border-forest/30 hover:border-forest/60 px-3 py-1 transition-colors"
                          style={{ borderRadius: '2px' }}
                        >
                          Rediger
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </>
            )}
          </div>
        ))}
      </div>
    </>
  )
}
