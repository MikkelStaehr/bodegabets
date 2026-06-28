'use client'

import { useState, useEffect } from 'react'

/**
 * Engangs-besked (3 sider) der præsenterer knockout-nyhederne, vist når
 * slutspillet er begyndt. Samme stil som VmRulesAnnouncement. Vises ÉN gang pr.
 * browser (versioneret nøgle) — og kun når knockout-fasen er i gang (gates i
 * page.tsx på at en knockout-runde er åbnet).
 */
const SEEN_KEY = 'bodega_vm_knockout_seen_v3'
const TOTAL_PAGES = 2

export default function KnockoutAnnouncement() {
  const [visible, setVisible] = useState(false)
  const [page, setPage] = useState(0)

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

  const title = page === 0 ? 'Knald eller fald 🏆' : 'On fire-kampen 🔥'
  const isLast = page === TOTAL_PAGES - 1

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/55 px-5 py-8 overflow-y-auto">
      <div
        className="bg-cream border border-warm-border rounded-sm w-full max-w-[440px] shadow-xl"
        style={{ animation: 'fadeSlideIn 0.22s ease' }}
      >
        {/* Header */}
        <div className="bg-forest rounded-t-sm px-5 py-4">
          <p className="font-condensed text-[11px] font-bold tracking-[0.14em] uppercase text-gold">
            Slutspillet · {page + 1}/{TOTAL_PAGES}
          </p>
          <h2 className="font-display text-[24px] font-bold text-cream leading-tight mt-0.5">{title}</h2>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-3">
          {page === 0 && (
            <>
              <p className="font-body text-[14px] text-ink leading-relaxed">
                Gruppespillet er slut — nu er det <strong>knald eller fald</strong>. Knockout-kampe
                kan ikke ende uafgjort, så du vælger ganske enkelt <strong>hvem der går videre</strong>.
              </p>
              <ul className="space-y-2.5">
                <RuleItem icon="🏆" title="Hvem går videre?">
                  Ingen uafgjort (X) — kun <strong>hjemme eller ude</strong>. Det tæller, uanset om
                  kampen blev afgjort i ordinær tid, forlænget eller på straffe.
                </RuleItem>
                <RuleItem icon="⏸️" title="Ekstra-bets holder pause">
                  Vi har <strong>midlertidigt sat ekstra-bets på pause</strong> i slutspillet, mens
                  vi analyserer den første runde. <strong>Stay tuned</strong> når blok 10 er ovre —
                  så melder vi tilbage! 👀
                </RuleItem>
              </ul>
            </>
          )}

          {page === 1 && (
            <>
              <p className="font-body text-[14px] text-ink leading-relaxed">
                Én tilfældig kamp i hver blok er <strong>🔥 on fire</strong>:
              </p>
              <ul className="space-y-2.5">
                <RuleItem icon="🔥" title="Dobbelt odds">
                  Alle dine bets på on-fire-kampen giver <strong>dobbelt gevinst</strong>.
                </RuleItem>
                <RuleItem icon="👀" title="Synlig fra start">
                  Kampen markeres med et <strong>🔥-badge</strong> på kuponen fra blokkens start, så du
                  kan satse derefter. Vælges tilfældigt og låses — den skifter ikke undervejs.
                </RuleItem>
              </ul>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 pt-1 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => (isLast ? dismiss() : setPage((p) => p + 1))}
            className="w-full h-[44px] rounded-sm bg-gold text-forest font-condensed text-[14px] font-bold tracking-[0.08em] uppercase hover:opacity-85 transition-opacity"
          >
            {isLast ? 'Forstået' : 'Videre →'}
          </button>
          {page > 0 && (
            <button
              type="button"
              onClick={() => setPage((p) => p - 1)}
              className="w-full h-[36px] text-warm-gray font-condensed text-[13px] font-bold tracking-[0.08em] uppercase hover:text-forest transition-colors"
            >
              ← Tilbage
            </button>
          )}
          <div className="flex items-center justify-center gap-1.5 pt-1">
            {Array.from({ length: TOTAL_PAGES }).map((_, p) => (
              <span key={p} className="rounded-full" style={{ width: 6, height: 6, background: p === page ? '#1a3329' : '#D4CFC4' }} />
            ))}
          </div>
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
