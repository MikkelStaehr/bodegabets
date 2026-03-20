'use client'

import { useState } from 'react'
import OnboardingModal from '@/components/OnboardingModal'

type Props = {
  onboardingCompleted: boolean
  children: React.ReactNode
}

export default function DashboardClient({ onboardingCompleted, children }: Props) {
  const [showOnboarding, setShowOnboarding] = useState(!onboardingCompleted)

  return (
    <>
      {showOnboarding && (
        <OnboardingModal onComplete={() => setShowOnboarding(false)} />
      )}
      {children}
    </>
  )
}
