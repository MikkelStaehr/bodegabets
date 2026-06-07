import { useEffect, useState } from 'react'

/**
 * Returnerer true når viewport er smallere end threshold (default 480px).
 * Bruges til mobile-first layout-tilpasninger der ikke kan udtrykkes som
 * fluid CSS (fx betinget rendering eller andre grid-templates).
 *
 * Server-side default er false så vi ikke flasher mobil-layoutet på desktop
 * under hydration — komponenter der bruger denne hook bør være okay med at
 * vise "wide"-layout én frame, hvilket er den almindelige tilstand på alle
 * desktop-renders.
 */
export function useNarrowViewport(threshold: number = 480): boolean {
  const [narrow, setNarrow] = useState(false)
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia(`(max-width: ${threshold}px)`)
    setNarrow(mq.matches)
    const handler = (e: MediaQueryListEvent) => setNarrow(e.matches)
    // Safari < 14 understøtter ikke addEventListener på MediaQueryList,
    // men det er <1% af trafikken, og fallback er bare "always wide".
    mq.addEventListener?.('change', handler)
    return () => mq.removeEventListener?.('change', handler)
  }, [threshold])
  return narrow
}
