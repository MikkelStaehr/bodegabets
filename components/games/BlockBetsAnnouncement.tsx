'use client'

import { useState, useEffect } from 'react'

/**
 * Nyheds-popup (2 sider) der præsenterer den nye "Blok Bets"-feature:
 * markederne → reglerne. Vises ÉN gang pr. browser, efter VM-regel-beskeden.
 * Nøglen er versioneret. Renderes kun for blok-modellen (gates i page.tsx).
 */
const SEEN_KEY = 'bodega_vm_block_bets_seen_v1'
// Vis først Blok Bets-nyheden når regel-beskeden er set (så de ikke stabler).
const RULES_SEEN_KEY = 'bodega_vm_leaderboard_seen_v6'
const TOTAL_PAGES = 2

export default function BlockBetsAnnouncement() {
  const [visible, setVisible] = useState(false)
  const [page, setPage] = useState(0)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (localStorage.getItem(SEEN_KEY)) return
    // Lad den grundlæggende regel-besked komme først for nye spillere.
    if (!localStorage.getItem(RULES_SEEN_KEY)) return
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

  const title = page === 0 ? 'Blok Bets er landet 🎯' : 'Sådan spiller du dem 🧱'
  const isLast = page === TOTAL_PAGES - 1

  return (
    <div className="fixed inset-0 z-[121] flex items-center justify-center bg-black/55 px-5 py-8 overflow-y-auto">
      <div
        className="bg-cream border border-warm-border rounded-sm w-full max-w-[440px] shadow-xl"
        style={{ animation: 'fadeSlideIn 0.22s ease' }}
      >
        {/* Header */}
        <div className="bg-forest rounded-t-sm px-5 py-4">
          <p className="font-condensed text-[11px] font-bold tracking-[0.14em] uppercase text-gold">
            Nyhed · {page + 1}/{TOTAL_PAGES}
          </p>
          <h2 className="font-display text-[24px] font-bold text-cream leading-tight mt-0.5">{title}</h2>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-3">
          {page === 0 && (
            <>
              <p className="font-body text-[14px] text-ink leading-relaxed">
                Helt nye bets der dækker <strong>hele blokken på én gang</strong> — ikke bare en
                enkelt kamp. Læg dem oven på dine almindelige bets:
              </p>
              <MarketsIllustration />
              <ul className="space-y-2.5">
                <RuleItem icon="🥅" title="Mål i blokken">
                  Over/under på <strong>alle blokkens mål samlet</strong>. Bliver det en målfattig
                  eller en vild blok?
                </RuleItem>
                <RuleItem icon="🏠" title="Dominans">
                  Bliver blokken domineret af <strong>hjemmesejre, uafgjorte eller udesejre</strong>?
                  (mindst 60% af kampene).
                </RuleItem>
                <RuleItem icon="🧤" title="Clean sheets">
                  Hvor mange hold <strong>holder buret rent</strong> i blokken — over/under på en linje.
                </RuleItem>
                <RuleItem icon="🎉" title="Målfest">
                  Kommer der nok <strong>højtscorende brag</strong> med 5+ mål i samme kamp?
                </RuleItem>
              </ul>
            </>
          )}

          {page === 1 && (
            <>
              <p className="font-body text-[14px] text-ink leading-relaxed">
                Fire ting at huske, så du spiller dem rigtigt:
              </p>
              <ul className="space-y-3">
                <RuleItem icon="🎯" title="Deler dine 1000 credits">
                  Blok Bets trækker fra <strong>samme blok-budget</strong> som dine kamp-bets — du
                  fordeler selv de 1000 mellem kampe og blokken.
                </RuleItem>
                <RuleItem icon="🔒" title="Lægges før blokken går i gang">
                  Du sætter dem ved blok-start. De <strong>låses</strong>, så snart blokkens første
                  kamp fløjtes i gang.
                </RuleItem>
                <RuleItem icon="🏁" title="Afgøres når blokken er færdig">
                  Når alle blokkens kampe er spillet, gøres bettet op på de <strong>samlede
                  tal</strong>, og gevinsten lander i din profit.
                </RuleItem>
                <RuleItem icon="📊" title="Tæller i leaderboardet">
                  Gevinster fra Blok Bets tæller med i <strong>point, profit og blok-vinderen</strong>
                  — præcis som dine kamp-bets.
                </RuleItem>
              </ul>
              <p className="font-body text-[12.5px] text-warm-gray leading-snug text-center pt-1">
                Klar fra <strong className="text-forest">blok 4</strong> — du finder dem øverst på kuponen 🎯
              </p>
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
          {page === 0 ? (
            <button
              type="button"
              onClick={dismiss}
              className="w-full h-[36px] text-warm-gray font-condensed text-[13px] font-bold tracking-[0.08em] uppercase hover:text-forest transition-colors"
            >
              Spring over
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setPage((p) => p - 1)}
              className="w-full h-[36px] text-warm-gray font-condensed text-[13px] font-bold tracking-[0.08em] uppercase hover:text-forest transition-colors"
            >
              ← Tilbage
            </button>
          )}
          {/* Side-indikator */}
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

/** Lille mock af Blok Bets-panelet — markeds-chips med eksempel-odds. */
function MarketsIllustration() {
  const chips = [
    { icon: '🥅', label: 'Mål i blokken', side: 'Over 22.5', odds: '1.85' },
    { icon: '🏠', label: 'Hjemme-dominans', side: 'Ja', odds: '4.0' },
    { icon: '🧤', label: 'Clean sheets', side: 'Under 3.5', odds: '1.85' },
    { icon: '🎉', label: 'Målfest', side: 'Ja', odds: '2.3' },
  ]
  return (
    <div className="bg-white border border-warm-border rounded-sm p-3">
      <div className="flex items-center gap-1.5 mb-2">
        <span className="text-[13px]">🎯</span>
        <span className="font-condensed text-[10px] font-bold tracking-[0.1em] uppercase text-gold-dark">Blok Bets</span>
        <span className="font-condensed text-[9px] text-warm-gray ml-auto">hele blokken samlet</span>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {chips.map((c) => (
          <div key={c.label} className="flex items-center gap-1.5 rounded-sm border border-warm-border bg-cream px-2 py-1.5">
            <span className="text-[13px] leading-none shrink-0">{c.icon}</span>
            <div className="min-w-0 flex-1">
              <p className="font-condensed text-[9.5px] font-bold text-forest leading-tight truncate">{c.label}</p>
              <p className="font-condensed text-[8.5px] text-warm-gray leading-tight">{c.side}</p>
            </div>
            <span className="font-condensed text-[10px] font-extrabold text-forest shrink-0">@{c.odds}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
