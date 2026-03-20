'use client'

import { useEffect } from 'react'

export default function HideNav() {
  useEffect(() => {
    const nav = document.querySelector('header') as HTMLElement | null
    if (nav) nav.style.display = 'none'
    return () => {
      if (nav) nav.style.display = ''
    }
  }, [])

  return null
}
