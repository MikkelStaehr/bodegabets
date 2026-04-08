'use client'

import { useEffect } from 'react'

export default function NavbarSportTheme({ sport }: { sport: string }) {
  useEffect(() => {
    const nav = document.querySelector('[data-navbar]')
    if (!nav) return
    nav.setAttribute('data-sport', sport)
    try { sessionStorage.setItem('game-sport', sport) } catch {}
    return () => nav.removeAttribute('data-sport')
  }, [sport])

  return null
}
