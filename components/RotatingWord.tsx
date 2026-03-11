'use client'

import { useState, useEffect } from 'react'

const words = [
  'vennerne.',
  'kollegaerne.',
  'familien.',
  'kæresten.',
  'naboerne.',
  'svigerforældrene.',
  'chefen.',
  'eksen.',
  'postmanden.',
  'tandlægen.',
]

export default function RotatingWord() {
  const [index, setIndex] = useState(0)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false)
      setTimeout(() => {
        setIndex((i) => (i + 1) % words.length)
        setVisible(true)
      }, 300)
    }, 2500)
    return () => clearInterval(interval)
  }, [])

  return (
    <span
      className="inline-block transition-all duration-300 ease-out"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(-8px)',
        minWidth: '5ch',
      }}
    >
      {words[index]}
    </span>
  )
}
