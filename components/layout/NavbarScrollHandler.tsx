'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

export default function NavbarScrollHandler() {
  const pathname = usePathname()
  const isHome = pathname === '/'

  useEffect(() => {
    const nav = document.querySelector('[data-navbar]') as HTMLElement | null
    if (!nav) return

    if (!isHome) {
      nav.removeAttribute('data-transparent')
      return
    }

    const handleScroll = () => {
      if (window.scrollY > 80) {
        nav.removeAttribute('data-transparent')
      } else {
        nav.setAttribute('data-transparent', '')
      }
    }

    // Sæt transparent ved mount
    nav.setAttribute('data-transparent', '')
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', handleScroll)
      nav.removeAttribute('data-transparent')
    }
  }, [isHome])

  return null
}
