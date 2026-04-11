'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const STEPS = [
  {
    icon: '🏆',
    title: 'Velkommen til Bodega Bets',
    body: 'Bodega Bets er et privat fantasy betting spil hvor du og dine venner konkurrerer om at forudsige kampresultater. Jo bedre dine forudsigelser — jo flere points.',
  },
  {
    icon: '🎯',
    title: 'Sådan fungerer en runde',
    body: 'Hver runde har en række kampe. Du får 1.000 credits at fordele. Vælg 1 (hjemme), X (uafgjort) eller 2 (ude) på hver kamp og sæt din indsats. Korrekt bet giver indsats × 2 tilbage.',
  },
  {
    icon: '⚡',
    title: 'Ekstra bets',
    body: 'På hver kamp kan du også afgive ekstra bets — scorer et hold 3+ mål, holder et hold clean sheet, eller vinder et hold med 2+ mål. Ekstra bets giver ekstra points.',
  },
  {
    icon: '📊',
    title: 'Leaderboard og points',
    body: 'Leaderboardet viser hvem der har tjent mest på tværs af runder. Points optjenes ved korrekte bets — jo højere indsats, jo større gevinst. Vind en runde og tjen en profilramme.',
  },
  {
    icon: '⏰',
    title: 'Husk deadline',
    body: 'Bets lukker 30 minutter før kampstart. Sørg for at afgive dine bets inden da — du kan altid ændre dem indtil deadline. Du skal placere bets hver runde for at forblive på leaderboardet.',
  },
  {
    icon: '🚀',
    title: 'Du er klar!',
    body: 'Gå ind i dit spilrum, find den aktive runde og afgiv dine første bets. Held og lykke — og måtte det bedste menneske vinde.',
  },
]

type Props = {
  onComplete: () => void
}

export default function OnboardingModal({ onComplete }: Props) {
  const [step, setStep] = useState(0)
  const [isCompleting, setIsCompleting] = useState(false)
  const router = useRouter()

  const current = STEPS[step]
  const isLast = step === STEPS.length - 1
  const progress = ((step + 1) / STEPS.length) * 100

  async function handleComplete() {
    setIsCompleting(true)
    await fetch('/api/onboarding/complete', { method: 'POST' })
    onComplete()
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="bg-[#F2EDE4] rounded-sm w-full max-w-[440px] overflow-hidden shadow-2xl">

        {/* Progress bar */}
        <div className="h-1 bg-[#e5e0d8] w-full">
          <div
            className="h-full bg-[#B8963E] transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Content */}
        <div className="px-8 py-10 flex flex-col items-center text-center gap-4">
          <span className="text-5xl">{current.icon}</span>
          <h2 className="font-['Playfair_Display'] text-[24px] font-bold text-[#1a3329] leading-tight">
            {current.title}
          </h2>
          <p className="font-body text-[14px] text-[#7a7060] leading-relaxed max-w-[320px]">
            {current.body}
          </p>
        </div>

        {/* Footer */}
        <div className="px-8 pb-8 flex items-center justify-between gap-3">
          {/* Step indicators */}
          <div className="flex gap-1.5">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`rounded-full transition-all duration-200 ${
                  i === step
                    ? 'w-4 h-2 bg-[#B8963E]'
                    : i < step
                    ? 'w-2 h-2 bg-[#B8963E]/50'
                    : 'w-2 h-2 bg-[#e5e0d8]'
                }`}
              />
            ))}
          </div>

          <div className="flex gap-2">
            {step > 0 && (
              <button
                type="button"
                onClick={() => setStep(s => s - 1)}
                className="h-10 px-4 rounded-sm border border-black/10 font-condensed text-[13px] font-bold text-[#7a7060] hover:text-[#1a3329] transition-colors"
              >
                Tilbage
              </button>
            )}
            <button
              type="button"
              onClick={isLast ? handleComplete : () => setStep(s => s + 1)}
              disabled={isCompleting}
              className="h-10 px-5 rounded-sm bg-[#1a3329] font-condensed text-[13px] font-bold text-[#F2EDE4] hover:bg-[#2C4A3E] transition-colors disabled:opacity-50"
            >
              {isLast ? (isCompleting ? 'Starter...' : 'Kom i gang →') : 'Næste →'}
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
