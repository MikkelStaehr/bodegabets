'use client'

import { useEffect, useState } from 'react'
import LeagueHubClient from '../LeagueHubClient'

type LeagueRow = {
  id: number
  name: string
  country: string
  bold_slug: string | null
  fixturedownload_slug: string | null
  last_synced_at: string | null
  bold_phase_id: number | null
  total_matches: number
}

type SyncLog = {
  id: number
  league_id: number
  synced_at: string
  matches_imported: number
  status: string
  message: string
}

export default function LigaerTab() {
  const [leagues, setLeagues] = useState<LeagueRow[]>([])
  const [logs, setLogs] = useState<SyncLog[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/leagues/hub')
      .then((r) => r.json())
      .then((d) => {
        setLeagues(d.leagues ?? [])
        setLogs(d.logs ?? [])
      })
      .catch(() => {
        setLeagues([])
        setLogs([])
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div style={{ fontFamily: 'sans-serif', fontSize: '12px', color: '#8C8C78' }}>
        Henter ligaer…
      </div>
    )
  }

  return <LeagueHubClient leagues={leagues} logs={logs} />
}
