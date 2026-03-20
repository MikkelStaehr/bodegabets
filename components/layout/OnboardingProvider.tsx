'use client'

import { useState, useEffect } from 'react'
import OnboardingModal from '@/components/OnboardingModal'

type Props = {
  onboardingCompleted: boolean
  children: React.ReactNode
}

export default function OnboardingProvider({ onboardingCompleted, children }: Props) {
  const [showOnboarding, setShowOnboarding] = useState(false)

  useEffect(() => {
    if (!onboardingCompleted) {
      setShowOnboarding(true)
    }
  }, [onboardingCompleted])

  return (
    <>
      {showOnboarding && (
        <OnboardingModal onComplete={() => setShowOnboarding(false)} />
      )}
      {children}
    </>
  )
}
