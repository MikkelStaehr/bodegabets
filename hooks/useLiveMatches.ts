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
  status: 'live' | 'halftime' | 'finished'
  kickoff_at: string
}

export type LiveSummary = {
  live: number
  halftime: number
  finished: number
  total: number
}

export function useLiveMatches(
  roundId: number | null,
  enabled = true
) {
  const [matches, setMatches] = useState<LiveMatch[]>([])
  const [summary, setSummary] = useState<LiveSummary>({ live: 0, halftime: 0, finished: 0, total: 0 })
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  const fetchLive = useCallback(async () => {
    if (!roundId || !enabled) return
    try {
      const res = await fetch(`/api/rounds/${roundId}/live-matches`)
      if (res.ok) {
        const json = await res.json()
        setMatches(json.matches ?? [])
        setSummary(json.summary ?? { live: 0, halftime: 0, finished: 0, total: 0 })
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
  gameId: number
  gameName: string
  leagueName: string | null
  roundId: number
  roundName: string
  matches: LiveMatch[]
  summary: LiveSummary
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
        const raw = json.items ?? []
        setItems(
          raw.map((item: { gameId: number; gameName: string; leagueName: string | null; roundId: number; roundName: string; matches: unknown[]; summary: LiveSummary }) => ({
            ...item,
            matches: (item.matches ?? []) as LiveMatch[],
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
