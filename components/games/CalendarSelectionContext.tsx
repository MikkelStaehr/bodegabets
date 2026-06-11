'use client'

import { createContext, useContext, useMemo, useState } from 'react'
import type { CalendarMatch } from './CalendarSlider'

/**
 * Deler den valgte kalender-dato mellem CalendarSlider og live-kassen
 * (ActiveRoundLiveTicker). Når man trykker på en anden dato end i dag, viser
 * live-kassen den dags kampe under live-kampene, adskilt med en linje.
 *
 * Holdt som en let client-context så vi ikke skal omstrukturere page'ets
 * store inline-props for kalender/ticker.
 */
export type CalendarSelection = {
  dateKey: string
  isToday: boolean
  matches: CalendarMatch[]
} | null

type Ctx = {
  selection: CalendarSelection
  setSelection: (s: CalendarSelection) => void
}

const CalendarSelectionCtx = createContext<Ctx | null>(null)

export function CalendarSelectionProvider({ children }: { children: React.ReactNode }) {
  const [selection, setSelection] = useState<CalendarSelection>(null)
  // useMemo så context-værdien (og dermed setSelection-identiteten konsumenter
  // ser) er stabil på tværs af renders.
  const value = useMemo(() => ({ selection, setSelection }), [selection])
  return <CalendarSelectionCtx.Provider value={value}>{children}</CalendarSelectionCtx.Provider>
}

export function useCalendarSelection() {
  return useContext(CalendarSelectionCtx)
}
