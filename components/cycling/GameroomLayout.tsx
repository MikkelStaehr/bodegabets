'use client'

import { useNarrowViewport } from '@/hooks/useNarrowViewport'

type Props = {
  left: React.ReactNode
  main: React.ReactNode
  right: React.ReactNode
}

/**
 * 3-kolonner gameroom-layout der respekterer mobile-first.
 *
 * <1024px (mobile + tablet): stack alt vertikalt i rækkefølgen main → left → right.
 *   Main først så lineup-builder møder brugeren med det samme. Sidebar-indhold
 *   følger nedenunder hvor det normalt ville være.
 *
 * >=1024px (desktop): 3-kolonne grid (220px / 1fr / 280px) med sticky sidebars
 *   så de følger med scroll. Main-kolonne er begrænset til ~600px så lineup-
 *   tabellen ikke bliver for bred at læse.
 */
export default function GameroomLayout({ left, main, right }: Props) {
  const narrow = useNarrowViewport(1024)

  if (narrow) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {main}
        {left}
        {right}
      </div>
    )
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '220px minmax(0, 1fr) 300px',
      gap: 24,
      alignItems: 'start',
    }}>
      <div style={{
        position: 'sticky', top: 20,
        display: 'flex', flexDirection: 'column', gap: 16,
      }}>
        {left}
      </div>
      <div style={{
        display: 'flex', flexDirection: 'column', gap: 24,
        minWidth: 0,
      }}>
        {main}
      </div>
      <div style={{
        position: 'sticky', top: 20,
        display: 'flex', flexDirection: 'column', gap: 16,
        maxHeight: 'calc(100vh - 40px)',
        overflowY: 'auto',
      }}>
        {right}
      </div>
    </div>
  )
}
