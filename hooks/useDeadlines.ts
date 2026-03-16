'use client'

import { useState, useEffect, useCallback } from 'react'

export type DeadlineItem = {
  game_id: number
  game_name: string
  league_name: string
  round_name: string
  betting_closes_at: string | null
  deadline_status: 'open' | 'closed' | 'upcoming'
  bets_submitted: boolean
}

export function useDeadlines(enabled = true) {
  const [deadlines, setDeadlines] = useState<DeadlineItem[]>([])
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  const fetchData = useCallback(async () => {
    if (!enabled) return
    try {
      const res = await fetch('/api/users/me/deadlines')
      if (res.ok) {
        const json = await res.json()
        setDeadlines(json.deadlines ?? [])
        setLastUpdate(new Date())
      }
    } catch {
      // Ignorer fejl
    }
  }, [enabled])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 60_000)
    return () => clearInterval(interval)
  }, [fetchData])

  return { deadlines, lastUpdate }
}
