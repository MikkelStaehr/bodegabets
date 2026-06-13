'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

/**
 * Engangs-besked (3 sider) der præsenterer slutrunde-modellen: blok/credit-
 * model → leaderboard → Losers Luck & nul-runde. Vises ÉN gang pr. browser,
 * første gang spilleren går ind i spilrummet. Nøglen er versioneret.
 *
 * Renderes kun for spil der kører blok-modellen (gates i page.tsx).
 */
const SEEN_KEY = 'bodega_vm_leaderboard_seen_v5'
const TOTAL_PAGES = 3

export default function VmRulesAnnouncement({ guideHref }: { guideHref: string }) {
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

  const title = page === 0 ? 'Sådan spiller du 🧱' : page === 1 ? 'Nyt leaderboard 📊' : 'Comeback & klovne 🍀🤡'
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
            Slutrunden · {page + 1}/{TOTAL_PAGES}
          </p>
          <h2 className="font-display text-[24px] font-bold text-cream leading-tight mt-0.5">{title}</h2>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-3">
          {page === 0 && (
            <>
              <p className="font-body text-[14px] text-ink leading-relaxed">
                Slutrunden kører i <strong>blokke</strong> — sådan fungerer dine credits:
              </p>
              <BlockIllustration />
              <ul className="space-y-2.5">
                <RuleItem icon="🧱" title="2 spillerunder = 1 blok">
                  Turneringen deles op i blokke på to runder.
                </RuleItem>
                <RuleItem icon="🎯" title="1000 credits pr. blok — ikke pr. runde">
                  Du fordeler dine 1000 credits hen over blokkens to runder. Gem evt. til runde to —
                  alt det du ikke bruger, er stadig i spil.
                </RuleItem>
                <RuleItem icon="🚫" title="Profit kan ikke spilles videre">
                  Alle starter hver blok med friske 1000, så ingen stikker af på en tidlig gevinst.
                </RuleItem>
                <RuleItem icon="🏅" title="Højest profit vinder blokken">
                  Den med mest profit i blokken får 1 blok-point. Det er blok-point der afgør spillet.
                </RuleItem>
              </ul>
            </>
          )}

          {page === 1 && (
            <>
              <p className="font-body text-[14px] text-ink leading-relaxed">
                Leaderboardet er en rigtig ligatabel. Sådan læser du den:
              </p>
              <LeaderboardIllustration />
              <ul className="space-y-2.5">
                <RuleItem icon="📑" title="To faner: Blok & Sæson">
                  <strong>Blok</strong> = den nuværende blok (bets, winrate, satset, point).
                  <strong> Sæson</strong> = din samlede placering.
                </RuleItem>
                <RuleItem icon="▲" title="Pile = bevægelse">
                  ▲ og ▼ viser hvor mange pladser du er rykket siden forrige spillede runde.
                </RuleItem>
                <RuleItem icon="🎯" title="MoM = Man of the Match">
                  Antal runder hvor du har scoret flest point. Et lille æresbevis ved siden af point.
                </RuleItem>
                <RuleItem icon="👆" title="Tryk på en spiller">
                  Se hele deres historik runde for runde (kun afgjorte spil).
                </RuleItem>
              </ul>
            </>
          )}

          {page === 2 && (
            <>
              <p className="font-body text-[14px] text-ink leading-relaxed">
                To krydderier — det ene hjælper, det andet driller:
              </p>
              <ul className="space-y-3">
                <RuleItem icon="🍀" title="Losers Luck — comeback-hjælp">
                  De <strong>to nederste i sæson-stillingen</strong> får <strong>+20% på deres
                  gevinster</strong> i blokken, så ingen stikker af. Du ser 🍀 ved deres navn, og er
                  du selv med, får du et banner på kuponen. Hvem der får det, låses ved blok-start.
                </RuleItem>
                <RuleItem icon="🤡" title="Nul-runde = klovne-mærke">
                  Scorer du <strong>0 point i en runde</strong> mens andre får point, får du et lille
                  klovne-mærke ved navnet (fx 🤡 Mr. Nullable). Det forsvinder igen, så snart du
                  scorer i næste runde. Hold tungen lige i munden! 😄
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
          {page === 0 ? (
            <Link
              href={guideHref}
              onClick={dismiss}
              className="w-full h-[40px] flex items-center justify-center rounded-sm border border-forest text-forest font-condensed text-[13px] font-bold tracking-[0.08em] uppercase hover:opacity-70 transition-opacity"
            >
              Se alle reglerne →
            </Link>
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

/** 2 runder = 1 blok med ét fælles 1000-credit-budget. */
function BlockIllustration() {
  const blocks = [
    { n: 1, rounds: [1, 2], current: true },
    { n: 2, rounds: [3, 4], current: false },
  ]
  return (
    <div className="bg-white border border-warm-border rounded-sm p-3">
      <div className="flex items-stretch gap-2">
        {blocks.map((b) => (
          <div key={b.n} className="flex-1 flex flex-col items-center gap-1.5">
            <span className={`font-condensed text-[9px] font-bold tracking-[0.1em] uppercase ${b.current ? 'text-gold-dark' : 'text-warm-gray'}`}>
              Blok {b.n}{b.current ? ' · nu' : ''}
            </span>
            <div className={`w-full flex gap-1 rounded-sm border p-1 ${b.current ? 'border-gold bg-gold/10' : 'border-warm-border bg-cream'}`}>
              {b.rounds.map((r) => (
                <div key={r} className="flex-1 flex flex-col items-center justify-center rounded-sm bg-forest/[0.06] py-1.5">
                  <span className="font-condensed text-[7px] font-bold tracking-[0.08em] uppercase text-warm-gray leading-none">Runde</span>
                  <span className="font-condensed text-[15px] font-bold text-forest leading-none mt-0.5">{r}</span>
                </div>
              ))}
            </div>
            <span className="font-condensed text-[10px] font-bold tracking-[0.04em] text-forest">🎯 1000 credits</span>
          </div>
        ))}
        <div className="flex items-center pl-0.5">
          <span className="font-condensed text-[14px] font-bold text-warm-border">→</span>
        </div>
      </div>
      <p className="font-body text-[10.5px] text-warm-gray text-center mt-2 leading-snug">
        2 spillerunder = 1 blok · de 1000 credits deles i blokken
      </p>
    </div>
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
      <div className="flex gap-1 px-2 pt-2">
        <span className="font-condensed text-[9px] font-bold tracking-[0.08em] uppercase px-2 py-0.5 rounded-sm bg-forest text-cream">Blok</span>
        <span className="font-condensed text-[9px] font-bold tracking-[0.08em] uppercase px-2 py-0.5 rounded-sm border border-warm-border text-warm-gray">Sæson</span>
      </div>
      <div className="grid items-center px-2 pt-2 pb-1" style={{ gridTemplateColumns: '54px 1fr auto 30px', gap: 6 }}>
        {['#', 'Spiller', 'Point', 'Blok'].map((h, i) => (
          <span key={h} className="font-condensed text-[8px] font-bold tracking-[0.08em] uppercase text-warm-gray" style={{ textAlign: i >= 2 ? 'right' : 'left' }}>{h}</span>
        ))}
      </div>
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
