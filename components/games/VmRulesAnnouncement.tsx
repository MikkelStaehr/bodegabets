'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

/**
 * Engangs-besked der præsenterer det nye leaderboard. Vises ÉN gang pr. browser,
 * første gang spilleren går ind i spilrummet efter rul-ud. Nøglen er versioneret,
 * så vi kan gen-annoncere når noget ændres.
 *
 * Renderes kun for spil der kører blok-modellen (gates i page.tsx).
 */
const SEEN_KEY = 'bodega_vm_leaderboard_seen_v3'

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
            Nyt · Opdatering
          </p>
          <h2 className="font-display text-[24px] font-bold text-cream leading-tight mt-0.5">
            Nyt leaderboard 📊
          </h2>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-3">
          <p className="font-body text-[14px] text-ink leading-relaxed">
            Vi har bygget leaderboardet om til en rigtig ligatabel. Her er hvad du skal vide:
          </p>

          <LeaderboardIllustration />

          <ul className="space-y-2.5">
            <RuleItem icon="📑" title="To faner: Blok & Sæson">
              <strong>Blok</strong> viser den nuværende blok — er du ved at vinde den? (vundne/tabte
              bets, winrate, satset, point). <strong>Sæson</strong> viser din samlede placering.
            </RuleItem>
            <RuleItem icon="▲" title="Pile = bevægelse">
              ▲ og ▼ viser hvor mange pladser du er rykket op eller ned siden forrige spillede runde.
            </RuleItem>
            <RuleItem icon="💰" title="Point (+/− profit)">
              Dine point med netto-profit i parentes — altså hvad du har vundet minus hvad du har satset.
            </RuleItem>
            <RuleItem icon="🏅" title="Blok-point afgør spillet">
              Antal vundne blokke afgør hvem der fører. 🏅 ved navnet betyder vinder af seneste blok.
            </RuleItem>
            <RuleItem icon="👆" title="Tryk på en spiller">
              Se hele deres historik runde for runde (kun afgjorte spil). MoM = Man of the Match,
              flest point i en runde.
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

/** Lille mock af ligatabellen — viser pile, point(±profit) og blok-point. */
function LeaderboardIllustration() {
  const rows = [
    { rank: 1, mv: '▲2', name: 'fredrp88', pts: '2140', profit: '+140', blok: '1', champ: true },
    { rank: 2, mv: '▼1', name: 'Stæhr', pts: '1720', profit: '−380', blok: '–', champ: false },
  ]
  return (
    <div className="bg-white border border-warm-border rounded-sm overflow-hidden">
      {/* tabs */}
      <div className="flex gap-1 px-2 pt-2">
        <span className="font-condensed text-[9px] font-bold tracking-[0.08em] uppercase px-2 py-0.5 rounded-sm bg-forest text-cream">Blok</span>
        <span className="font-condensed text-[9px] font-bold tracking-[0.08em] uppercase px-2 py-0.5 rounded-sm border border-warm-border text-warm-gray">Sæson</span>
      </div>
      {/* header */}
      <div className="grid items-center px-2 pt-2 pb-1" style={{ gridTemplateColumns: '54px 1fr auto 30px', gap: 6 }}>
        {['#', 'Spiller', 'Point', 'Blok'].map((h, i) => (
          <span key={h} className="font-condensed text-[8px] font-bold tracking-[0.08em] uppercase text-warm-gray" style={{ textAlign: i >= 2 ? 'right' : 'left' }}>{h}</span>
        ))}
      </div>
      {/* rows */}
      {rows.map((r, i) => (
        <div key={r.rank} className="grid items-center px-2 py-1.5" style={{ gridTemplateColumns: '54px 1fr auto 30px', gap: 6, borderTop: '1px solid #EDE8DF', background: i === 0 ? '#F8F5ED' : '#fff' }}>
          <span className="flex items-baseline gap-1">
            <span className="font-condensed text-[12px] font-bold" style={{ color: i === 0 ? '#B8963E' : '#7A7A7A' }}>{r.rank}</span>
            <span className="text-[8px] font-bold" style={{ color: r.mv.startsWith('▲') ? '#2C4A3E' : '#C8392B' }}>{r.mv}</span>
          </span>
          <span className="font-condensed text-[12px] font-semibold text-ink truncate">
            {r.name}{r.champ && <span className="ml-1 text-[10px]">🏅</span>}
          </span>
          <span className="text-right whitespace-nowrap">
            <span className="font-condensed text-[12px] font-extrabold text-ink">{r.pts}</span>
            <span className="font-condensed text-[9px] font-bold ml-0.5" style={{ color: r.profit.startsWith('+') ? '#2C4A3E' : '#C8392B' }}>({r.profit})</span>
          </span>
          <span className="font-condensed text-[12px] font-extrabold text-right" style={{ color: r.blok === '–' ? '#ccc' : '#B8963E' }}>{r.blok}</span>
        </div>
      ))}
    </div>
  )
}
