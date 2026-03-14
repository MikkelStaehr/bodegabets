'use client'

import { useState, useEffect, useCallback } from 'react'

export type LiveMatch = {
  id: number
  home_team: string
  away_team: string
  home_score: number | null
  away_score: number | null
  home_score_ht: number | null
  away_score_ht: number | null
  status: 'live' | 'halftime' | 'finished' | 'scheduled'
  kickoff_at: string
  bet?: { prediction: string; result: string | null } | null
}

export type LiveSummary = {
  live: number
  halftime: number
  finished: number
  scheduled: number
  total: number
}

export function useLiveMatches(
  roundId: number | null,
  enabled = true
) {
  const [matches, setMatches] = useState<LiveMatch[]>([])
  const [summary, setSummary] = useState<LiveSummary>({ live: 0, halftime: 0, finished: 0, scheduled: 0, total: 0 })
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  const fetchLive = useCallback(async () => {
    if (!roundId || !enabled) return
    try {
      const res = await fetch(`/api/rounds/${roundId}/live-matches`)
      if (res.ok) {
        const json = await res.json()
        setMatches(json.matches ?? [])
        setSummary(json.summary ?? { live: 0, halftime: 0, finished: 0, scheduled: 0, total: 0 })
        setLastUpdate(new Date())
      }
    } catch {
      // Ignorer fejl
    }
  }, [roundId, enabled])

  useEffect(() => {
    fetchLive()
    const interval = setInterval(fetchLive, 30_000)
    return () => clearInterval(interval)
  }, [fetchLive])

  return { matches, summary, lastUpdate }
}

// ─── Brugerens live kampe (alle aktive spil) ──────────────────────────────────

export type LiveMatchesForUserItem = {
  leagueId: number
  leagueName: string
  matches: LiveMatch[]
}

export function useLiveMatchesForUser(enabled = true) {
  const [items, setItems] = useState<LiveMatchesForUserItem[]>([])
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  const fetchData = useCallback(async () => {
    if (!enabled) return
    try {
      const res = await fetch('/api/users/me/live-matches')
      if (res.ok) {
        const json = await res.json()
        const raw = json.leagues ?? []
        setItems(
          raw.map((league: { league_id: number; league_name: string; matches: unknown[] }) => ({
            leagueId: league.league_id,
            leagueName: league.league_name,
            matches: (league.matches ?? []) as LiveMatch[],
          }))
        )
        setLastUpdate(new Date())
      }
    } catch {
      // Ignorer fejl
    }
  }, [enabled])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 30_000)
    return () => clearInterval(interval)
  }, [fetchData])

  return { items, lastUpdate }
}
