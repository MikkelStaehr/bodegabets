'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { GameState, MatchEntry, MatchSummary, LeaderboardEntry } from '@/lib/gameState'

export type { GameState, MatchEntry, MatchSummary, LeaderboardEntry }

type UseGameStateOptions = {
  /** Initial server-rendered state (optional, undgår loading-flash) */
  initialState?: GameState | null
  /** Slå polling fra (default true) */
  enabled?: boolean
}

type UseGameStateResult = {
  state: GameState | null
  isLoading: boolean
  error: string | null
  lastUpdate: Date | null
  refresh: () => Promise<void>
}

/**
 * Poll-frekvens:
 *   - 30s når der er live/halftime/scheduled kampe
 *   - 2min når alt er finished
 *   - Pauses når document er hidden (spar bandwidth når tab er baggrunds)
 */
function hasActiveMatches(matches: MatchEntry[]): boolean {
  return matches.some((m) => m.status === 'live' || m.status === 'halftime' || m.status === 'scheduled')
}

/**
 * Single source of truth for et fodbold gameroom.
 * Leverer matches, leaderboard og game meta i én request.
 */
export function useGameState(
  gameId: number | null,
  options: UseGameStateOptions = {},
): UseGameStateResult {
  const { initialState = null, enabled = true } = options

  const [state, setState] = useState<GameState | null>(initialState)
  const [isLoading, setIsLoading] = useState(initialState === null)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(initialState ? new Date() : null)

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latestMatchesRef = useRef<MatchEntry[]>(initialState?.matches ?? [])
  const abortRef = useRef<AbortController | null>(null)

  const fetchState = useCallback(async () => {
    if (!gameId || !enabled) return
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    try {
      const res = await fetch(`/api/games/${gameId}/state`, { signal: controller.signal })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? `HTTP ${res.status}`)
        return
      }
      const json = (await res.json()) as GameState
      setState(json)
      latestMatchesRef.current = json.matches
      setLastUpdate(new Date())
      setError(null)
    } catch (e) {
      if ((e as { name?: string })?.name === 'AbortError') return
      setError(e instanceof Error ? e.message : 'Fejl')
    } finally {
      setIsLoading(false)
    }
  }, [gameId, enabled])

  useEffect(() => {
    if (!gameId || !enabled) return
    let cancelled = false

    function schedule() {
      if (cancelled) return
      if (typeof document !== 'undefined' && document.hidden) {
        // Ingen polling mens tab er hidden — vågn op ved visibilitychange
        return
      }
      const delay = hasActiveMatches(latestMatchesRef.current) ? 30_000 : 120_000
      timeoutRef.current = setTimeout(async () => {
        if (cancelled) return
        await fetchState()
        schedule()
      }, delay)
    }

    async function start() {
      if (!state) await fetchState()
      schedule()
    }

    function onVisibilityChange() {
      if (document.hidden) {
        if (timeoutRef.current) clearTimeout(timeoutRef.current)
      } else {
        // Refetch straks når tab bliver synlig igen
        fetchState().then(() => schedule())
      }
    }

    start()
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibilityChange)
    }

    return () => {
      cancelled = true
      abortRef.current?.abort()
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibilityChange)
      }
    }
    // state bevidst udeladt — vi vil ikke trigge ny poll hver gang state ændres
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, enabled, fetchState])

  return { state, isLoading, error, lastUpdate, refresh: fetchState }
}
