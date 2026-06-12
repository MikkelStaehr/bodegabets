'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

/**
 * Engangs-besked om de nye blok-regler i slutrunden (VM). Vises ÉN gang pr.
 * browser, første gang spilleren går ind i spilrummet efter rul-ud. Nøglen er
 * versioneret, så vi kan gen-annoncere hvis reglerne ændres igen.
 *
 * Renderes kun for spil der kører blok-credit-modellen (gates i page.tsx).
 */
const SEEN_KEY = 'bodega_vm_blokregler_seen_v1'

export default function VmRulesAnnouncement({ guideHref }: { guideHref: string }) {
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
      // ignorér (private mode el.lign.)
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
            Vigtigt · Nye regler
          </p>
          <h2 className="font-display text-[24px] font-bold text-cream leading-tight mt-0.5">
            Slutrunden kører nu i blokke 🏆
          </h2>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-3">
          <p className="font-body text-[14px] text-ink leading-relaxed">
            Vi har hørt jer — credits-modellen er lavet om, så den matcher vores
            blok-DNA fra sæsonerne. Kort fortalt:
          </p>

          <ul className="space-y-2.5">
            <RuleItem icon="🧱" title="2 spillerunder = 1 blok">
              Slutrunden deles op i blokke på to runder.
            </RuleItem>
            <RuleItem icon="🎯" title="1000 credits pr. blok — ikke pr. runde">
              Du fordeler dine 1000 credits hen over blokkens to runder. Brug
              dem klogt: alt du gemmer til runde to, er stadig i spil.
            </RuleItem>
            <RuleItem icon="🚫" title="Profit kan ikke spilles videre">
              Alle starter hver blok med friske 1000. Ingen kan løbe fra feltet
              på en tidlig gevinst — det holder det fair.
            </RuleItem>
            <RuleItem icon="🏅" title="Blok-vinderen får 1 blok-point">
              Den med højest samlet profit i blokken vinder blokken. Står to
              lige, får de begge et blok-point. Det er blok-point der afgør
              stillingen.
            </RuleItem>
          </ul>
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 pt-1 flex flex-col gap-2">
          <button
            type="button"
            onClick={dismiss}
            className="w-full h-[44px] rounded-sm bg-gold text-forest font-condensed text-[14px] font-bold tracking-[0.08em] uppercase hover:opacity-85 transition-opacity"
          >
            Forstået
          </button>
          <Link
            href={guideHref}
            onClick={dismiss}
            className="w-full h-[40px] flex items-center justify-center rounded-sm border border-forest text-forest font-condensed text-[13px] font-bold tracking-[0.08em] uppercase hover:opacity-70 transition-opacity"
          >
            Se alle reglerne →
          </Link>
        </div>
      </div>
    </div>
  )
}

function RuleItem({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <span className="text-[18px] leading-none shrink-0 mt-0.5">{icon}</span>
      <div>
        <p className="font-condensed text-[14px] font-bold text-forest leading-tight">{title}</p>
        <p className="font-body text-[12.5px] text-warm-gray leading-snug mt-0.5">{children}</p>
      </div>
    </li>
  )
}
