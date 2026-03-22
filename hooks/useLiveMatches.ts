'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'

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
  second_half_started_at?: string | null
  home_team_logo: string | null
  away_team_logo: string | null
  tournamentLogo?: string | null
  userPrediction?: string | null
  bet_open?: boolean
  distribution?: { '1': number; 'X': number; '2': number; total: number } | null
}

export type LiveSummary = {
  live: number
  halftime: number
  finished: number
  scheduled: number
  total: number
}

function hasActiveMatches(matches: LiveMatch[]): boolean {
  return matches.some(m => m.status === 'live' || m.status === 'halftime' || m.status === 'scheduled')
}

export function useLiveMatches(
  roundId: number | null,
  enabled = true
) {
  const [matches, setMatches] = useState<LiveMatch[]>([])
  const [summary, setSummary] = useState<LiveSummary>({ live: 0, halftime: 0, finished: 0, scheduled: 0, total: 0 })
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const latestMatchesRef = useRef<LiveMatch[]>([])
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchLive = useCallback(async () => {
    if (!roundId || !enabled) return
    try {
      const res = await fetch(`/api/rounds/${roundId}/live-matches`)
      if (res.ok) {
        const json = await res.json()
        const data = json.matches ?? []
        setMatches(data)
        latestMatchesRef.current = data
        setSummary(json.summary ?? { live: 0, halftime: 0, finished: 0, scheduled: 0, total: 0 })
        setLastUpdate(new Date())
      }
    } catch {
      // Ignorer fejl
    }
  }, [roundId, enabled])

  useEffect(() => {
    let cancelled = false
    async function poll() {
      await fetchLive()
      if (cancelled) return
      const delay = hasActiveMatches(latestMatchesRef.current) ? 30_000 : 120_000
      timeoutRef.current = setTimeout(poll, delay)
    }
    poll()
    return () => { cancelled = true; clearTimeout(timeoutRef.current) }
  }, [fetchLive])

  return { matches, summary, lastUpdate }
}

// ─── Live kampe for et helt spil (alle sæsoner) ─────────────────────────────

export function useLiveMatchesForGame(
  gameId: number | null,
  enabled = true
) {
  const [matches, setMatches] = useState<LiveMatch[]>([])
  const [summary, setSummary] = useState<LiveSummary>({ live: 0, halftime: 0, finished: 0, scheduled: 0, total: 0 })
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const hasLoadedOnce = useRef(false)
  const router = useRouter()
  const prevStatusRef = useRef<Record<number, string>>({})
  const latestMatchesRef = useRef<LiveMatch[]>([])
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchLive = useCallback(async () => {
    if (!gameId || !enabled) return
    try {
      const res = await fetch(`/api/games/${gameId}/live-matches`)
      if (res.ok) {
        const json = await res.json()
        const data = json.matches ?? []
        setMatches(data)
        latestMatchesRef.current = data
        setSummary(json.summary ?? { live: 0, halftime: 0, finished: 0, scheduled: 0, total: 0 })
        setLastUpdate(new Date())
        if (!hasLoadedOnce.current) {
          hasLoadedOnce.current = true
          setIsLoading(false)
        }

        // Detekter kampe der netop er skiftet til finished
        let anyFinished = false
        for (const match of data) {
          const prevStatus = prevStatusRef.current[match.id]
          if (prevStatus && prevStatus !== 'finished' && match.status === 'finished') {
            anyFinished = true
          }
          prevStatusRef.current[match.id] = match.status
        }

        if (anyFinished) {
          // Vent 3 sekunder så calculateRoundPoints når at køre
          setTimeout(() => router.refresh(), 3000)
        }
      }
    } catch {
      // Ignorer fejl
    }
  }, [gameId, enabled, router])

  useEffect(() => {
    let cancelled = false
    async function poll() {
      await fetchLive()
      if (cancelled) return
      const delay = hasActiveMatches(latestMatchesRef.current) ? 30_000 : 120_000
      timeoutRef.current = setTimeout(poll, delay)
    }
    poll()
    return () => { cancelled = true; clearTimeout(timeoutRef.current) }
  }, [fetchLive])

  return { matches, summary, lastUpdate, isLoading }
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
  const latestItemsRef = useRef<LiveMatchesForUserItem[]>([])
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchData = useCallback(async () => {
    if (!enabled) return
    try {
      const res = await fetch('/api/users/me/live-matches')
      if (res.ok) {
        const json = await res.json()
        const raw = json.items ?? []
        const parsed = raw.map((item: { gameId: number; gameName: string; leagueName: string | null; roundId: number; roundName: string; matches: unknown[]; summary: LiveSummary }) => ({
          ...item,
          matches: (item.matches ?? []) as LiveMatch[],
        }))
        setItems(parsed)
        latestItemsRef.current = parsed
        setLastUpdate(new Date())
      }
    } catch {
      // Ignorer fejl
    }
  }, [enabled])

  useEffect(() => {
    let cancelled = false
    async function poll() {
      await fetchData()
      if (cancelled) return
      const allMatches = latestItemsRef.current.flatMap(i => i.matches)
      const delay = hasActiveMatches(allMatches) ? 30_000 : 120_000
      timeoutRef.current = setTimeout(poll, delay)
    }
    poll()
    return () => { cancelled = true; clearTimeout(timeoutRef.current) }
  }, [fetchData])

  return { items, lastUpdate }
}
