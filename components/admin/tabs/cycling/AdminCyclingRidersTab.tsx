'use client'

import React, { useEffect, useState } from 'react'
import { formatDateTime } from '@/lib/dateUtils'

type Props = Record<string, never>
type RiderStats = {
  total: number
  byCategory: Record<number, number>
  lastSynced: string | null
}

type Rider = {
  id: string
  first_name: string
  last_name: string
  team_name: string
  category: number
  photo_url: string | null
  team_logo_url: string | null
  pcs_slug: string
}

export function AdminCyclingRidersTab() {
  const [riderStats, setRiderStats] = useState<RiderStats | null>(null)
  const [riders, setRiders] = useState<Rider[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState<number | null>(null)
  const [filterPhoto, setFilterPhoto] = useState<'all' | 'missing' | 'has'>('all')
  const [syncLoading, setSyncLoading] = useState(false)
  const [syncMsg, setSyncMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const authHeader = {
    'Content-Type': 'application/json',
      }

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/cycling/overview', { headers: authHeader }).then((r) => r.json()),
      fetch('/api/admin/cycling/riders', { headers: authHeader }).then((r) => r.json()),
    ])
      .then(([overview, ridersData]) => {
        if (overview.riders) setRiderStats(overview.riders)
        if (ridersData.riders) setRiders(ridersData.riders)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleSync() {
    setSyncLoading(true)
    setSyncMsg(null)
    try {
      const res = await fetch('/api/admin/cycling/sync-riders', {
        method: 'POST',
        headers: authHeader,
      })
      const data = await res.json()
      setSyncMsg({ type: 'ok', text: data.message ?? 'Sync besked sendt' })
    } catch {
      setSyncMsg({ type: 'err', text: 'Netv\u00e6rksfejl' })
    } finally {
      setSyncLoading(false)
      setTimeout(() => setSyncMsg(null), 5000)
    }
  }

  if (loading) {
    return (
      <div className="border border-warm-border bg-cream p-8 text-center" style={{ borderRadius: '2px' }}>
        <p className="font-condensed text-[13px] text-warm-gray uppercase tracking-wide">Henter ryttere...</p>
      </div>
    )
  }

  const filteredRiders = riders.filter((r) => {
    if (filterCat !== null && r.category !== filterCat) return false
    if (filterPhoto === 'missing' && r.photo_url) return false
    if (filterPhoto === 'has' && !r.photo_url) return false
    if (search.trim()) {
      const q = search.toLowerCase()
      if (!r.first_name.toLowerCase().includes(q) && !r.last_name.toLowerCase().includes(q) && !r.team_name.toLowerCase().includes(q)) return false
    }
    return true
  })

  const missingPhotoCount = riders.filter((r) => !r.photo_url).length
  const missingTeamLogoCount = riders.filter((r) => !r.team_logo_url).length

  return (
    <div className="space-y-6">
      {/* ── Stats row ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        {riderStats && [1, 2, 3, 4, 5].map((cat) => (
          <div key={cat} className="border border-warm-border bg-cream p-3" style={{ borderRadius: '2px' }}>
            <span className="font-condensed text-[10px] uppercase text-warm-gray tracking-wide">Kat {cat}</span>
            <p className="font-condensed font-bold text-ink text-xl">{riderStats.byCategory[cat] ?? 0}</p>
          </div>
        ))}
      </div>

      {/* ── Data quality ─────────────────────────────────────────── */}
      <div className="border border-warm-border bg-cream p-5" style={{ borderRadius: '2px' }}>
        <h2 className="font-condensed font-bold text-ink text-lg uppercase tracking-wide mb-3">Datakvalitet</h2>
        <div className="flex gap-6 font-body text-[13px]">
          <div>
            <span className="text-warm-gray">Mangler foto: </span>
            <span className={missingPhotoCount > 0 ? 'text-vintage-red font-medium' : 'text-forest font-medium'}>
              {missingPhotoCount} / {riders.length}
            </span>
          </div>
          <div>
            <span className="text-warm-gray">Mangler holdlogo: </span>
            <span className={missingTeamLogoCount > 0 ? 'text-vintage-red font-medium' : 'text-forest font-medium'}>
              {missingTeamLogoCount} / {riders.length}
            </span>
          </div>
          <div>
            <span className="text-warm-gray">Sidst synk: </span>
            <span className="text-ink">{riderStats?.lastSynced ? formatDateTime(riderStats.lastSynced) : 'Aldrig'}</span>
          </div>
        </div>
      </div>

      {/* ── Filters + sync ───────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="S\u00f8g rytter eller hold..."
          className="font-body text-[13px] border border-warm-border bg-cream px-3 py-2 w-64 outline-none focus:border-forest"
          style={{ borderRadius: '2px' }}
        />
        <select
          value={filterCat ?? ''}
          onChange={(e) => setFilterCat(e.target.value ? Number(e.target.value) : null)}
          className="font-condensed text-[12px] uppercase tracking-wide border border-warm-border bg-cream px-3 py-2"
          style={{ borderRadius: '2px' }}
        >
          <option value="">Alle kategorier</option>
          {[1, 2, 3, 4, 5].map((c) => <option key={c} value={c}>Kat {c}</option>)}
        </select>
        <select
          value={filterPhoto}
          onChange={(e) => setFilterPhoto(e.target.value as 'all' | 'missing' | 'has')}
          className="font-condensed text-[12px] uppercase tracking-wide border border-warm-border bg-cream px-3 py-2"
          style={{ borderRadius: '2px' }}
        >
          <option value="all">Alle billeder</option>
          <option value="missing">Mangler foto</option>
          <option value="has">Har foto</option>
        </select>
        <button
          onClick={handleSync}
          disabled={syncLoading}
          className="ml-auto font-condensed text-[12px] font-semibold text-forest px-4 py-2 border border-warm-border hover:bg-cream-dark disabled:opacity-50"
          style={{ borderRadius: '2px' }}
        >
          {syncLoading ? 'Synkroniserer...' : 'Synkroniser ryttere'}
        </button>
        {syncMsg && (
          <span className={`font-body text-[12px] ${syncMsg.type === 'ok' ? 'text-forest' : 'text-vintage-red'}`}>
            {syncMsg.text}
          </span>
        )}
      </div>

      {/* ── Rider count ──────────────────────────────────────────── */}
      <p className="font-condensed text-[11px] text-warm-gray uppercase tracking-wide">
        {filteredRiders.length} ryttere
      </p>

      {/* ── Rider table ──────────────────────────────────────────── */}
      <div className="border border-warm-border bg-cream overflow-hidden" style={{ borderRadius: '2px' }}>
        <div className="overflow-x-auto max-h-[70vh] overflow-y-auto">
          <table className="w-full font-body text-[13px]">
            <thead className="sticky top-0 bg-cream">
              <tr className="font-condensed text-[10px] font-bold text-warm-gray uppercase tracking-wider border-b border-warm-border">
                <th className="text-left px-3 py-2 w-10">Foto</th>
                <th className="text-left px-3 py-2">Navn</th>
                <th className="text-left px-3 py-2">Hold</th>
                <th className="text-center px-3 py-2">Kat</th>
                <th className="text-center px-3 py-2">Logo</th>
              </tr>
            </thead>
            <tbody>
              {filteredRiders.map((rider) => (
                <tr key={rider.id} className="border-b border-warm-border">
                  <td className="px-3 py-1.5">
                    {rider.photo_url ? (
                      <img src={rider.photo_url} alt="" className="w-8 h-8 object-cover" style={{ borderRadius: '2px' }} />
                    ) : (
                      <div className="w-8 h-8 bg-cream-dark flex items-center justify-center" style={{ borderRadius: '2px' }}>
                        <span className="text-warm-gray text-[9px]">?</span>
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-1.5 text-ink font-medium">
                    {rider.last_name} <span className="font-normal text-warm-gray">{rider.first_name}</span>
                  </td>
                  <td className="px-3 py-1.5 text-warm-gray">{rider.team_name}</td>
                  <td className="px-3 py-1.5 text-center">
                    <span className="font-condensed text-[10px] font-bold uppercase border px-1.5 py-0.5 text-warm-gray border-warm-border" style={{ borderRadius: '2px' }}>
                      {rider.category}
                    </span>
                  </td>
                  <td className="px-3 py-1.5 text-center">
                    {rider.team_logo_url ? (
                      <img src={rider.team_logo_url} alt="" className="w-5 h-5 object-contain mx-auto" />
                    ) : (
                      <span className="text-vintage-red text-[10px]">Mangler</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
