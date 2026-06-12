'use client'

import { useState, useEffect } from 'react'

/**
 * Engangs-guide til kuponen (AfgivBets). Vises ÉN gang pr. browser, første
 * gang spilleren åbner en bet-kupon. Forklarer de universelle mekanikker:
 * vælg udfald, justér indsats, ekstra valg, lås. Versioneret nøgle så vi kan
 * gen-vise hvis guiden ændres.
 */
const SEEN_KEY = 'bodega_kupon_guide_seen_v1'

export default function BetSlipGuide() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (localStorage.getItem(SEEN_KEY)) return
    setVisible(true)
  }, [])

  function dismiss() {
    try {
      localStorage.setItem(SEEN_KEY, '1')
    } catch {
      // ignorér
    }
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/55 px-5 py-8 overflow-y-auto">
      <div
        className="bg-cream border border-warm-border rounded-sm w-full max-w-[440px] shadow-xl"
        style={{ animation: 'fadeSlideIn 0.22s ease' }}
      >
        {/* Header */}
        <div className="bg-forest rounded-t-sm px-5 py-4">
          <p className="font-condensed text-[11px] font-bold tracking-[0.14em] uppercase text-gold">
            Sådan virker kuponen
          </p>
          <h2 className="font-display text-[24px] font-bold text-cream leading-tight mt-0.5">
            Udfyld din kupon 🎟️
          </h2>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          {/* 1. Vælg udfald */}
          <Step n={1} title="Vælg udfald">
            <p className="mb-2">
              Tryk <strong>1</strong> (hjemmesejr), <strong>X</strong> (uafgjort)
              eller <strong>2</strong> (udesejr) på hver kamp.
            </p>
            <Outcome />
          </Step>

          {/* 2. Justér indsats */}
          <Step n={2} title="Justér din indsats">
            <p className="mb-2">
              Med <strong>−</strong> og <strong>+</strong> (eller skriv tallet)
              bestemmer du hvor mange credits du satser. Højere indsats = flere
              point hvis du rammer.
            </p>
            <Stake />
          </Step>

          {/* 3. Ekstra valg */}
          <Step n={3} title="Ekstra valg">
            <p className="mb-2">
              Tryk <strong>“+ Ekstra valg”</strong> på en kamp for at satse ekstra
              — hver med sine egne odds:
            </p>
            <div className="flex flex-wrap gap-1.5">
              <Pill>Clean sheet</Pill>
              <Pill>Scorer 3+ mål</Pill>
              <Pill>Vinder med 2+</Pill>
            </div>
          </Step>

          {/* 4. Maxe ud + lås */}
          <Step n={4} title="Brug dine credits & lås">
            <p>
              Du har et fast credit-budget. Brug <strong>“Maxe ud”</strong> for at
              lægge resten i spil — ubrugte credits giver ingen point. Tryk til
              sidst <strong>“Lås dine valg”</strong>.
            </p>
          </Step>
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 pt-1">
          <button
            type="button"
            onClick={dismiss}
            className="w-full h-[44px] rounded-sm bg-gold text-forest font-condensed text-[14px] font-bold tracking-[0.08em] uppercase hover:opacity-85 transition-opacity"
          >
            Forstået — lad mig spille
          </button>
        </div>
      </div>
    </div>
  )
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="shrink-0 w-6 h-6 rounded-full bg-forest text-cream font-condensed text-[13px] font-bold flex items-center justify-center mt-0.5">
        {n}
      </span>
      <div className="min-w-0">
        <p className="font-condensed text-[15px] font-bold text-forest leading-tight mb-1">{title}</p>
        <div className="font-body text-[12.5px] text-warm-gray leading-snug">{children}</div>
      </div>
    </div>
  )
}

/* Mini-illustration af 1 / X / 2-knapperne (1 valgt) */
function Outcome() {
  return (
    <div className="flex gap-1 max-w-[200px]">
      {(['1', 'X', '2'] as const).map((o) => {
        const active = o === '1'
        return (
          <div
            key={o}
            className={`flex-1 py-1.5 rounded-sm border-[1.5px] text-center font-condensed text-[15px] font-bold ${
              active ? 'bg-forest border-forest text-cream' : 'bg-white border-warm-border text-warm-gray'
            }`}
          >
            {o}
          </div>
        )
      })}
    </div>
  )
}

/* Mini-illustration af indsats-stepperen */
function Stake() {
  return (
    <div className="flex items-center gap-1">
      <div className="w-7 h-7 rounded-sm border border-warm-border bg-white text-forest font-bold flex items-center justify-center">−</div>
      <div className="w-16 h-7 rounded-sm border border-warm-border bg-white flex items-center justify-center font-condensed text-[14px] font-bold text-forest">
        100
      </div>
      <span className="text-[10px] text-warm-gray font-semibold">pt</span>
      <div className="w-7 h-7 rounded-sm border border-warm-border bg-white text-forest font-bold flex items-center justify-center">+</div>
    </div>
  )
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-condensed text-[11px] font-semibold text-forest bg-forest/[0.07] border border-forest/15 rounded-sm px-2 py-1">
      {children}
    </span>
  )
}
